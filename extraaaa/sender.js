const { fs, path, gapiUrlSendMessage, gapiUrlSendImage, chatId, axios, formData } = require('./libs');

async function sendMessage(message, filePath = null, quotedMessageId = null) {
    if (filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('File tidak ditemukan.');
            }
            const form = new formData();
            // const fileName = path.basename(filePath);
            form.append('file', fs.createReadStream(filePath));
            form.append('caption', message);
            form.append('chatId', chatId);
            const response = await axios.post(gapiUrlSendImage, form, {
                headers: form.getHeaders()
            });
            return response.data
        } catch (err) {
            console.error('❌ Gagal mengirim:', err.response?.data || err.message);
        }
    } else {
        try {
            const payload = { chatId, message }
            if (quotedMessageId) {
                payload.quotedMessageId = quotedMessageId
            }
            const response = await axios.post(gapiUrlSendMessage, payload)
            return response.data
        } catch (err) {
            console.error('❌ Gagal mengirim:', err.response?.data || err.message);
        }
    }
}

module.exports = {
    sendMessage
}