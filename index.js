#!/usr/bin/env /usr/local/bin/node

const bitbar = require('bitbar');
const moment = require('moment');
const isOnline = require('is-online');
const { getAPIWrapperWithAxiosInstance, NoCardError } = require('presto-card-js');
const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;

const config = require('./config');
const Colors = require('./lib/Colors');
const PrestoMetadata = require('./lib/PrestoMetadata');
const PrestoActivityTypes = require('./lib/PrestoActivityTypes');
const TextParsing = require('./lib/TextParsing');

function getColorForBalance(balance, lastUpdatedDate) {
    const diffHours = moment().diff(lastUpdatedDate, 'hours');

    if (diffHours > LAST_UPDATED_THRESHOLD_HOURS) {
        return Colors.OutOfDate;
    }

    if (balance > BALANCE_LOW_THRESHOLD) {
        return Colors.Good;
    }
    else if (balance <= 0) {
        return Colors.Bad;
    }
    return 'orange';
}

function getColorForLastUpdated(lastUpdatedDate) {
    const diffHours = moment().diff(lastUpdatedDate, 'hours');
    if (diffHours <= LAST_UPDATED_THRESHOLD_HOURS) {
        return Colors.Good;
    }
    else if (diffHours < 48) {
        return 'orange';
    }
    return Colors.Bad;
}

const totalByMonth = (accumulator, activity) => {
    const date = moment(activity.date, 'M/DD/YYYY H:mm:ss A').format('YYYY MMM');
    accumulator[date] = (accumulator[date] || 0) + TextParsing.parseDollarAmount(activity.amount)
    return accumulator;
};

function convertToSubMenu(totalByLabel) {
    var farePaymentsMenu = {
        text: 'Fare payments',
        submenu: []
    };

    var labels = Object.keys(totalByLabel);
    var subMenuItems = labels.map(label => { return { text: label + ' ($' + totalByLabel[label] + ')', color: 'white' } });

    for (var i = 0; i < subMenuItems.length; i++) {
        farePaymentsMenu.submenu.push(subMenuItems[i]);
        if (i !== subMenuItems.length - 1) {
            farePaymentsMenu.submenu.push(bitbar.separator);
        }
    }
    return farePaymentsMenu;

}

const axiosInstance = axiosCookieJarSupport(axios);
axiosInstance.defaults.jar = true;
const prestoCard = getAPIWrapperWithAxiosInstance(axiosInstance);
const username = config.username;
const password = config.password;

const BALANCE_LOW_THRESHOLD = 6.00;
const LAST_UPDATED_THRESHOLD_HOURS = 24;
const ACTIVITY_REQUEST_PAGE_SIZE = 9999;

(async () => {
    const connectedToInternet = await isOnline();

    if (!connectedToInternet) {
        return bitbar([
            {
                image: PrestoMetadata.logo,
                text: ':x: No internet',
                color: Colors.Warning,
                dropdown: false
            },
            bitbar.separator,
            {
                text: 'Not connected to internet',
                color: Colors.Warning,
                dropdown: true
            }
        ]);
    }

    const isLoggedIn = await prestoCard.isLoggedIn();
    if (!isLoggedIn) {
        const loginResponse = await prestoCard.login(username, password);
        if (!loginResponse.success) {
            return bitbar([
                {
                    image: PrestoMetadata.logo,
                    text: ':warning:',
                    color: Colors.Warning,
                    dropdown: false
                },
                bitbar.separator,
                {
                    text: 'Bad credentials?',
                    color: Colors.Warning,
                    dropdown: true
                }
            ]);
        }
    }

    try {
        const balance = await prestoCard.getBalance();

        const twoYearsAgo = moment().startOf('year').subtract(2, 'years');
        const activity = await prestoCard.getActivityByDateRange(twoYearsAgo.format('YYYY-MM-DD'), moment().format('YYYY-MM-DD'), ACTIVITY_REQUEST_PAGE_SIZE);

        const summation = (accumulator, currentValue) => accumulator + currentValue;
        const totalEverPaid = activity.filter(a => a.type === PrestoActivityTypes.FarePayment)
            .map(a => TextParsing.parseDollarAmount(a.amount))
            .reduce(summation, 0);

        const activityBinnedByMonth = activity.filter(a => a.type === PrestoActivityTypes.FarePayment).reduce(totalByMonth, {});
        var paymentHistory = convertToSubMenu(activityBinnedByMonth);
        paymentHistory.text = paymentHistory.text + ' ($' + totalEverPaid + ')';

        const formattedBalance = balance.balance;
        const numericBalance = TextParsing.parseDollarAmount(formattedBalance);
        const lastUpdatedOn = moment(balance.lastUpdatedOn);

        bitbar([
            {
                image: PrestoMetadata.logo,
                text: balance.balance,
                color: getColorForBalance(numericBalance, lastUpdatedOn),
                dropdown: false
            },
            bitbar.separator,
            {
                text: 'PRESTO system last updated ' + lastUpdatedOn.fromNow(),
                href: PrestoMetadata.url,
                color: getColorForLastUpdated(lastUpdatedOn)
            },
            bitbar.separator,
            paymentHistory
        ]);

    } catch (e) {
        if (e instanceof NoCardError) {
            bitbar([
                {
                    image: PrestoMetadata.logo,
                    text: ':warning:',
                    color: Colors.Warning,
                    dropdown: false
                },
                bitbar.separator,
                {
                    text: 'No card associated with this account',
                    color: Colors.Warning,
                    dropdown: true
                }
            ]);
        }
        else {
            bitbar([
                {
                    image: PrestoMetadata.logo,
                    text: ':warning:',
                    color: Colors.Warning,
                    dropdown: false
                },
                bitbar.separator,
                {
                    text: e,
                    color: Colors.Warning,
                    dropdown: true
                }
            ]);
        }
    }
    await prestoCard.logout();
})();
