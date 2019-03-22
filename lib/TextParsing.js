module.exports = {
    parseDollarAmount: function (balanceString) {
        return Number(balanceString.substr(balanceString.indexOf('$') + 1));
    }
}
