const fsPromises = require('fs/promises');
const fs = require('fs');
const path = require('path');
const axios = require('axios')
const formData = require('form-data');
const ics = require('ics');
const dayjs = require('dayjs');
const { createEvent } = require('ics');
const chatId = "120363420329714359@g.us"
const resultJsonPath = path.resolve(__dirname, 'results.json');
const calendarPath = path.resolve(__dirname, 'calendar.ics');

const gapiUrlSendMessage = "https://7103.api.greenapi.com/waInstance7103857775/sendMessage/93e0e286f6a944998c57aeb778407aa82119a829a9db413c91"
const gapiUrlSendImage = "https://7103.media.greenapi.com/waInstance7103857775/sendFileByUpload/93e0e286f6a944998c57aeb778407aa82119a829a9db413c91"
module.exports = {
    fs,
    fsPromises,
    path,
    resultJsonPath,
    gapiUrlSendMessage,
    gapiUrlSendImage,
    axios,
    formData,
    chatId,
    ics,
    createEvent,
    calendarPath,
    dayjs
};