const fs = require("fs");
const testMode = Boolean(process.env.TEST_MODE);

function generateRandomSignal() {
  const randomSignal = (Math.random() * (3.5 - 1.5) + 1.5).toFixed(2);

  return parseFloat(randomSignal);
}

function userRequest(msg, bot) {
  const chatId = msg.from.id;
  const adminChatId = Number(
    testMode ? process.env.TEST_ADMIN_CHAT_ID : process.env.ADMIN_CHAT_ID
  );
  const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const user = users.find((x) => x.id === chatId);

  if (!user) {
    console.error("User not found");
    return;
  }

  bot.sendMessage(
    adminChatId,
    `Запрос на доступ от ${user?.nick || user?.name}`,
    {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "Принять",
              callback_data: `accepted:${chatId}`,
            },
          ],
          [
            {
              text: "Отклонить",
              callback_data: `cancel:${chatId}`,
            },
          ],
        ],
      }),
    }
  );
  bot.sendMessage(
    chatId,
    "Ваш запрос был направлен администратору. Ожидайте завершения проверки."
  );
}

function sendCoefficient(msg, bot) {
  const chatId = msg.from.id;
  const users = JSON.parse(fs.readFileSync("./assets/data/users.json"));
  const texts = JSON.parse(fs.readFileSync("./assets/data/texts.json"));
  const user = users.find((x) => x.id === chatId);
  const text = msg?.text;
  const randomSignal = generateRandomSignal();

  const coefficientRegex = /\b\d+(\.\d+)?\b/;
  const coefficientMatch = text.match(coefficientRegex);

  if (!user) {
    console.error("User not found");
    return;
  }

  if (coefficientMatch) {
    const enteredCoefficient = parseFloat(coefficientMatch[0]);

    const messageLink = texts?.firstMessageText
      .split("SHU HAVOLA:")[1]
      ?.split(" ")[0];

    const formatedMessage = texts.firstMessageText
      .replace("{oldCeff}", enteredCoefficient)
      .replace("{newCeff}", randomSignal)
      .replace(
        `SHU HAVOLA:${messageLink}`,
        `<a href="${messageLink}">SHU HAVOLA</a>`
      );

    bot.sendPhoto(chatId, texts?.firstMessageImagePath, {
      caption: formatedMessage,
      parse_mode: "HTML",
    });
  } else {
    bot.sendMessage(
      chatId,
      "‼️Iltimos, aynan koefficientni yozing, siz notog'ri malumotni kiritdingiz, bot buni aniqlamadi❌"
    );
  }
}

module.exports = {
  userRequest,
  sendCoefficient,
};
