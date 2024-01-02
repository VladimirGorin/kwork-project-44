require("dotenv").config({ path: "./assets/.env" });
const winston = require("winston");
const { combine, timestamp, printf } = winston.format;
const cron = require("node-cron");

const testMode = JSON.parse(process.env.TEST_MODE);

const adminChatId = Number(
  testMode ? process.env.TEST_ADMIN_CHAT_ID : process.env.ADMIN_CHAT_ID
);

console.log(adminChatId)

const TelegramBotApi = require("node-telegram-bot-api");
const bot = new TelegramBotApi(
  testMode ? process.env.TOKEN_TEST : process.env.TOKEN,
  { polling: true }
);

const fs = require("fs");

const errorLogger = winston.createLogger({
  level: "error",
  format: combine(
    timestamp(),
    printf((error) => `${error.timestamp} - ${error.message}`)
  ),
  transports: [
    new winston.transports.File({
      filename: "errors.log",
      dirname: "./assets/logs/",
    }),
  ],
});

try {
  const { userRequest, sendCoefficient } = require("./assets/modules/utils");
  const commands = JSON.parse(fs.readFileSync("./assets/data/commands.json"));

  bot.setMyCommands(commands);

  const handleSendCoefficient = (msg) => {
    sendCoefficient(msg, bot);
    bot.removeListener("message", handleSendCoefficient);
  };

  function checkPaymentStatus(query) {
    const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
    const userId = query.split(":")[1];
    const user = users.find((x) => x.id === Number(userId));

    if (query.includes("cancel:")) {
      if (!user) {
        users.forEach((admin) => {
          if (admin.isAdmin) {
            bot.sendMessage(admin.id, `Пользователь не найден ${userId}`);
          }
        });
      }
      user.haveAссess = false;

      fs.writeFileSync(
        "./assets/data/users.json",
        JSON.stringify(users, null, "\t")
      );

      bot.sendMessage(userId, `Доступ отклонен!`);
      users.forEach((admin) => {
        if (admin.isAdmin) {
          bot.sendMessage(
            admin.id,
            `Вы успешно отклонили доступ для ${
              user?.nick || user?.name
            }!\nПользователю был отправлен ответ`
          );
        }
      });
    } else if (query.includes("accepted:")) {
      if (!user) {
        users.forEach((admin) => {
          if (admin.isAdmin) {
            bot.sendMessage(admin.id, `Пользователь не найден ${userId}`);
          }
        });
      }
      user.haveAссess = true;

      fs.writeFileSync(
        "./assets/data/users.json",
        JSON.stringify(users, null, "\t")
      );

      bot.sendMessage(
        userId,
        `Ваша заявка принята!\nДля активации пропишите /start`
      );

      users.forEach((admin) => {
        if (admin.isAdmin) {
          bot.sendMessage(
            admin.id,
            `Вы успешно выдали доступ для ${
              user?.nick || user?.name
            }!\nПользователю была направлена инструкция`
          );
        }
      });
    }
  }

  function adminPanel(msg) {
    const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
    const texts = JSON.parse(fs.readFileSync("./assets/data/texts.json"));
    const buttons = JSON.parse(fs.readFileSync("./assets/data/buttons.json"));

    let user = users.filter((x) => x.id === msg.from.id)[0];

    const query = msg?.data;

    if (!user) {
      console.error("ChatId not found");
      return;
    }

    if (user.isAdmin) {
      switch (query) {
        case "changeFirstMessage":
          bot.sendMessage(user.id, "Выберете вариант изминения", {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "Изминить текст",
                    callback_data: `changeFirstMessageText`,
                  },
                ],
                [
                  {
                    text: "Изминить картинку",
                    callback_data: `changeFirstMessageImage`,
                  },
                ],
              ],
            }),
          });

          break;
        case "changeTwoMessage":
          bot.sendMessage(user.id, "Выберете вариант изминения", {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "Изминить текст",
                    callback_data: `changeTwoMessageText`,
                  },
                ],
              ],
            }),
          });

          break;

        case "changeFirstMessageText":
          bot.sendMessage(
            user.id,
            "Отправьте текст как указано на примере\n\nПример:\n➡SHU HAVOLA:Введите тут ссылку ORQALI OYNASANGIZ BOLADI⬅ \n\n❌Oldin uchgani - {oldCeff}\n\n✅ Hozir uchadi - {newCeff}\n\n‼Ehtiyot bo'ling va to'g'ri oynang, barcha savollar boyicha, adminga murojat qilsangiz boladi‼"
          );

          const changeFirstMessageText = (msg) => {
            texts.firstMessageText = msg?.text;

            fs.writeFileSync(
              "./assets/data/texts.json",
              JSON.stringify(texts, null, "\t")
            );
            bot.sendMessage(user.id, "Текст успешно сохранен");
            bot.removeListener("message", changeFirstMessageText);
          };

          bot.on("message", changeFirstMessageText);

          break;
        case "changeFirstMessageImage":
          bot.sendMessage(user.id, "Отправьте картинку в формате jpg или png");

          const changeFirstMessageImage = (msg) => {
            if (msg.photo) {
              const fileId = msg.photo[msg.photo.length - 1].file_id;

              if (!user) {
                console.error("User not found");
                return;
              }

              const filePath = `./assets/data/images/saved/${fileId}.jpg`;
              const fileStream = fs.createWriteStream(filePath);

              bot.getFileStream(fileId).pipe(fileStream);

              fileStream.on("error", (error) => {
                console.error(`Error downloading file: ${error}`);
              });

              fileStream.on("finish", () => {
                texts.firstMessageImagePath = filePath;
                fs.writeFileSync(
                  "./assets/data/texts.json",
                  JSON.stringify(texts, null, "\t")
                );

                bot.sendMessage(user.id, `Картинка успешно установлена`);
              });
            }
          };

          bot.on("photo", changeFirstMessageImage);
          break;

        case "changeTwoMessageText":
          bot.sendMessage(
            user.id,
            "Отправьте текст в любом формате\n\nПример: Привет мир сегодня\nОтличная погода"
          );

          const changeTwoMessageText = (msg) => {
            texts.twoMessageText = msg?.text;

            fs.writeFileSync(
              "./assets/data/texts.json",
              JSON.stringify(texts, null, "\t")
            );
            bot.sendMessage(user.id, "Текст успешно сохранен");

            bot.removeListener("message", changeTwoMessageText);
          };

          bot.on("message", changeTwoMessageText);

          break;
        case "addAdmins":
          bot.sendMessage(
            user.id,
            "Отправьте ID админа или админов через запятую\nПолучить его можно в этом боте - @GetMyChatID_Bot"
          );

          const addAdmins = (msg) => {
            const adminsIds = (msg?.text.trim().split(", ") || []).map(Number);

            users?.forEach((item) => {
              const userId = item.id;

              if (adminsIds.includes(userId)) {
                item.isAdmin = true;
              }
            });

            adminsIds.forEach((adminId) => {
              const foundUser = users.find((user) => user.id === adminId);

              if (!foundUser) {
                bot.sendMessage(
                  user.id,
                  `Пользователь с ID ${adminId} не найден`
                );
              } else {
                bot.sendMessage(user.id, `Пользователь с ID ${adminId} найден`);
              }
            });

            fs.writeFileSync(
              "./assets/data/users.json",
              JSON.stringify(users, null, "\t")
            );

            bot.removeListener("message", addAdmins);
          };

          bot.on("message", addAdmins);

          break;

        case "changeMessages":
          bot.sendMessage(
            user.id,
            "Выберете сообщения которое вы хотите изминить",
            {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    {
                      text: "Первое сообщение",
                      callback_data: `changeFirstMessage`,
                    },
                  ],
                  [
                    {
                      text: "Второе сообщение",
                      callback_data: `changeTwoMessage`,
                    },
                  ],
                ],
              }),
            }
          );

        case "analytics":
          const dailyAssetCount = users.filter((u) => u.dailyAsset).length;
          const adminsCount = users.filter((u) => u.isAdmin).length;
          const haveAссessCount = users.filter((u) => u.haveAссess).length;
          const text = `Всего людей в базе: ${users?.length}\nВсего используют каждый день: ${dailyAssetCount}\nВсего людей имеют доступ к боту: ${haveAссessCount}\nВсего админов: ${adminsCount}`;

          bot.sendMessage(user.id, text);

          break;

        case "buttons":
          bot.sendMessage(user.id, "Выберете работу с кнопками:", {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "Добавить кнопки",
                    callback_data: `addButtons`,
                  },
                  {
                    text: "Удалить кнопки",
                    callback_data: `removeButtons`,
                  },
                ],
                [
                  {
                    text: "Добавить контент в кнопки",
                    callback_data: `addContent`,
                  },
                ],
              ],
            }),
          });

          break;

        case "addButtons":
          bot.sendMessage(user.id, "Введите названия кнопок через запятую");

          const addButtons = (msg) => {
            const formatedButtons = msg?.text.split(", ");

            formatedButtons.forEach((item) => {
              buttons.push({
                text: item,
                content: {
                  caption: "Заглушка",
                  imagePath: null,
                },
              });
            });

            fs.writeFileSync(
              "./assets/data/buttons.json",
              JSON.stringify(buttons, null, "\t")
            );

            bot.sendMessage(user.id, "Кнопки успешно установлены");
            bot.removeListener("message", addButtons);
          };

          bot.on("message", addButtons);

          break;

        case "removeButtons":
          bot.sendMessage(user.id, "Введите названия кнопок через запятую");

          const removeButtons = (msg) => {
            const formatedButtons = msg?.text.split(", ");

            let removedButtons = [];

            formatedButtons.forEach((item) => {
              const buttonIndex = buttons.findIndex(
                (button) => button.text === item
              );

              if (buttonIndex !== -1) {
                removedButtons.push(buttons[buttonIndex]);
                buttons.splice(buttonIndex, 1);
              }
            });

            if (removedButtons.length > 0) {
              fs.writeFileSync(
                "./assets/data/buttons.json",
                JSON.stringify(buttons, null, "\t")
              );

              bot.sendMessage(
                user.id,
                `Удалены кнопки: ${removedButtons
                  .map((btn) => btn.text)
                  .join(", ")}`
              );
            } else {
              bot.sendMessage(user.id, "Кнопки не найдены в базе данных.");
            }

            bot.removeListener("message", removeButtons);
          };

          bot.on("message", removeButtons);

          break;

        case "addContent":
          bot.sendMessage(
            user.id,
            "Отправьте названия кнопки а за тем картинку с подписью если хотите загрузить сообщение с картинкой\nПример:Названия кнопки, Контент кнопки [фото]"
          );

          const addContent = (msg) => {
            const text = msg?.text || msg?.caption;
            const formatedText = text?.split(", ");

            const findButton = buttons.find(
              (button) => button?.text === formatedText[0]
            );

            if (!findButton) {
              bot.sendMessage(user.id, "Кнопка не найдена!");

              bot.removeListener("message", addContent);
              bot.removeListener("photo", addContent);
              return;
            }

            if (!formatedText[1]) {
              bot.sendMessage(user.id, "Не найдено текст!");

              bot.removeListener("message", addContent);
              bot.removeListener("photo", addContent);
              return;
            }

            if (msg.photo) {
              const fileId = msg.photo[msg.photo.length - 1].file_id;

              if (!user) {
                console.error("User not found");
                return;
              }

              const filePath = `./assets/data/images/${fileId}.jpg`;
              const fileStream = fs.createWriteStream(filePath);

              bot.getFileStream(fileId).pipe(fileStream);

              fileStream.on("error", (error) => {
                console.error(`Error downloading file: ${error}`);
              });

              fileStream.on("finish", () => {
                findButton.content.caption = formatedText[1];
                findButton.content.imagePath = filePath;

                fs.writeFileSync(
                  "./assets/data/buttons.json",
                  JSON.stringify(buttons, null, "\t")
                );
                bot.sendMessage(
                  user.id,
                  `Картинка с текстом для кнопки ${formatedText[0]} успешно установлены`
                );
              });
            } else {
              findButton.content.caption = formatedText[1];
              findButton.content.imagePath = null;

              fs.writeFileSync(
                "./assets/data/buttons.json",
                JSON.stringify(buttons, null, "\t")
              );

              bot.sendMessage(
                user.id,
                `Текст для кнопки ${formatedText[0]} успешно установлена`
              );
            }

            bot.removeListener("message", addContent);
            bot.removeListener("photo", addContent);
          };

          bot.on("message", addContent);
          bot.on("photo", addContent);

          break;

        default:
          break;
      }
    } else {
      bot.sendMessage(user.id, "Вы не админ");
    }
  }

  function filterMessages(messageType, msg) {
    const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
    const texts = JSON.parse(fs.readFileSync("./assets/data/texts.json"));
    const buttons = JSON.parse(fs.readFileSync("./assets/data/buttons.json"));
    let user = users.filter((x) => x.id === msg.from.id)[0];

    const username = user?.nick || user?.name;

    const command = msg?.text;
    const query = msg?.data;

    user.dailyAsset = true;

    fs.writeFileSync(
      "./assets/data/users.json",
      JSON.stringify(users, null, "\t")
    );

    if (!user) {
      console.error("ChatId not found");
      return;
    }

    if (user?.haveAссess) {
      if (messageType === "message") {
        if (command) {
          switch (command) {
            case "/admin":
              if (user.isAdmin) {
                bot.sendMessage(user.id, "Админ панель", {
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [
                        {
                          text: "Изминить сообщения",
                          callback_data: `changeMessages`,
                        },
                      ],
                      [
                        {
                          text: "Назначить админов",
                          callback_data: `addAdmins`,
                        },
                      ],
                      [
                        {
                          text: "Работа с кнопками",
                          callback_data: `buttons`,
                        },
                      ],
                      [
                        {
                          text: "Получить аналитику",
                          callback_data: `analytics`,
                        },
                      ],
                    ],
                  }),
                });
              } else {
                bot.sendMessage(user.id, "Вы не админ");
              }
              break;

            case "/start":
              const buttonsText = buttons.map((item) => [item.text]);

              bot.sendPhoto(user.id, "./assets/data/images/firstMessage.jpg", {
                caption: `${username} salom👋\n\nSizni, LuckyJet oyini uchun, signal beruvchi botida, korganimizdan hursandmiz😊\n\nBuyerda, bot sizga LuckyJet oyinida, raketa qachon va qay vaqtda uchishini aniq aytib beradi, oyida omad va etiborli bo'ling😎`,
                reply_markup: {
                  keyboard: [
                    [
                      "Signal olish",
                      "O'yinga oid, barcha qiziqarli savollaringizga javob‼",
                    ],
                    ...buttonsText,
                  ],
                  resize_keyboard: true,
                },
              });
              break;

            case "O'yinga oid, barcha qiziqarli savollaringizga javob‼":
              bot.sendMessage(user.id, texts?.twoMessageText);
              break;

            case "Signal olish":
              bot.sendMessage(
                user.id,
                `🙌Hurmatli ${username} raketa, qaysi holatda uchib ketdi, shuni yozing va bot sizga aniq koefficientni yozib o'tadi✅\n\nO'yinda omad❤️`
              );

              bot.on("message", handleSendCoefficient);
              break;

            default:
              const findQuery = buttons.find(
                (button) => button?.text === command
              );

              if (findQuery) {
                if (findQuery?.content?.imagePath) {
                  bot.sendPhoto(user.id, findQuery?.content?.imagePath, {
                    caption: findQuery?.content?.caption,
                  });
                } else {
                  bot.sendMessage(user.id, findQuery?.content?.caption);
                }
              }

              break;
          }
        } else {
          bot.sendMessage(user.id, "Command не найден");
        }
      } else if (messageType === "query") {
        if (query) {
          switch (query) {
            default:
              checkPaymentStatus(query);
              adminPanel(msg);
              break;
          }
        } else {
          bot.sendMessage(user.id, "Query не найден");
        }
      } else {
        bot.sendMessage(user.id, "Фильтр не нашел нужного типа.");
      }
    } else {
      if (query === "getAccess") {
        userRequest(msg, bot);
      } else {
        bot.sendMessage(
          user.id,
          `${username} Afsuski, sizda bot uchun dostup yoq. Iltimos, to'lovni amalga oshiring va adminga murojat qiling.`,
          {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "Запросить",
                    callback_data: `getAccess`,
                  },
                ],
              ],
            }),
          }
        );
      }
    }
  }

  bot.on("message", (msg) => {
    if (msg.photo) {
      return;
    }

    const chatId = msg.chat.id;
    const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
    let user = users.filter((x) => x.id === msg.from.id)[0];

    if (!user) {
      const admin = chatId === adminChatId;

      users.push({
        id: msg.from.id,
        nick: msg.from.username,
        name: msg.from.first_name,
        haveAссess: admin ? true : false,
        isAdmin: admin ? true : false,
      });

      user = users.filter((x) => x.id === msg.from.id)[0];
      fs.writeFileSync(
        "./assets/data/users.json",
        JSON.stringify(users, null, "\t")
      );
    }

    filterMessages("message", msg);
  });

  bot.on("callback_query", (msg) => {
    filterMessages("query", msg);
  });
} catch (error) {
  console.log("Have new error! Check in logs");
  errorLogger.error(error);
}

cron.schedule("0 12 * * *", () => {
  const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  console.log("first");
  users?.forEach((user) => {
    if (user.dailyAsset) {
      user.dailyAsset = false;
    }
  });

  fs.writeFileSync(
    "./assets/data/users.json",
    JSON.stringify(users, null, "\t")
  );
});

bot.on("polling_error", console.log);
