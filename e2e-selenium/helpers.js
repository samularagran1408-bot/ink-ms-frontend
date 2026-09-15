const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
const DEFAULT_TIMEOUT = 15000;

function buildChromeOptions() {
  const options = new chrome.Options();
  if (process.env.SELENIUM_HEADED !== '1') {
    options.addArguments('--headless=new');
  }
  options.addArguments(
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,800',
    '--lang=es-ES'
  );
  options.setAcceptInsecureCerts(true);
  return options;
}

async function createDriver() {
  return new Builder().forBrowser('chrome').setChromeOptions(buildChromeOptions()).build();
}

async function open(driver, path = '/') {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  await driver.get(url);
}

async function waitVisible(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

function byText(tag, text) {
  return By.xpath(`//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})]`);
}

async function clickText(driver, tag, text) {
  const element = await waitVisible(driver, byText(tag, text));
  await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', element);
  await element.click();
}

async function waitUrlContains(driver, fragment, timeout = DEFAULT_TIMEOUT) {
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl();
    return url.includes(fragment);
  }, timeout);
}

async function waitText(driver, text, timeout = DEFAULT_TIMEOUT) {
  return waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), ${JSON.stringify(text)})]`), timeout);
}

async function mockLoginUnauthorized(driver) {
  const connection = await driver.createCDPConnection('page');
  const body = Buffer.from(JSON.stringify({ message: 'Unauthorized' })).toString('base64');

  driver._cdpWsConnection.on('message', (message) => {
    const payload = JSON.parse(message.toString());
    if (payload.method !== 'Fetch.requestPaused') {
      return;
    }

    const { requestId, request } = payload.params;
    if (String(request.url).includes('/api/auth/login')) {
      connection.execute('Fetch.fulfillRequest', {
        requestId,
        responseCode: 401,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
        ],
        body,
      });
      return;
    }

    connection.execute('Fetch.continueRequest', { requestId });
  });

  await connection.execute('Fetch.enable', {
    patterns: [{ urlPattern: '*', requestStage: 'Request' }],
  }, null);
}

module.exports = {
  BASE_URL,
  By,
  until,
  createDriver,
  open,
  waitVisible,
  waitText,
  waitUrlContains,
  clickText,
  byText,
  mockLoginUnauthorized,
};
