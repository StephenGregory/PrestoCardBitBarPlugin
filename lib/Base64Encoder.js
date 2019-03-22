const fs = require('fs');

module.exports = {
    encode: function (filePath) {
        var bitmap = fs.readFileSync(filePath);
        return new Buffer(bitmap).toString('base64');
    }
}
