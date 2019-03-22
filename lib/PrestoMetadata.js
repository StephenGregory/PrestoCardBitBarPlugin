
const base64Encoder = require('./Base64Encoder');
const path = require('path');

const logoLocation = path.resolve(path.dirname(__dirname), './resource/prestocard.png');
const prestoLogo = base64Encoder.encode(logoLocation);

module.exports = {
    logo: prestoLogo,
    url: 'https://prestocard.ca'
}
