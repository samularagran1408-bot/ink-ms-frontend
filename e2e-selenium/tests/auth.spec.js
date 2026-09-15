const {
  By,
  createDriver,
  open,
  waitText,
  waitUrlContains,
  waitVisible,
  clickText,
  mockLoginUnauthorized,
} = require('../helpers');

describe('Autenticación (Selenium)', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  afterEach(async function () {
    if (driver) {
      await driver.quit();
    }
  });

  it('el login muestra error si se envía vacío', async function () {
    await open(driver, '/login');
    await clickText(driver, 'button', 'Acceder');
    await waitText(driver, 'Este campo es obligatorio.');
  });

  it('el login muestra credenciales denegadas ante un 401', async function () {
    await mockLoginUnauthorized(driver);
    await open(driver, '/login');

    await waitVisible(driver, By.css('input[type="email"]'));
    await driver.findElement(By.css('input[type="email"]')).sendKeys('demo@inklusport.test');
    await driver.findElement(By.css('.login-form input[type="password"]')).sendKeys('clave-incorrecta');
    await clickText(driver, 'button', 'Acceder');

    await waitText(driver, 'Credenciales denegadas');
    await waitText(driver, 'Reintentar');
  });

  it('desde login se abre la recuperación de contraseña', async function () {
    await open(driver, '/login');
    await clickText(driver, 'a', '¿Olvidaste tu contraseña?');

    await waitUrlContains(driver, '/forgot-password');
    await waitText(driver, 'Recuperación de Contraseña');
    await waitText(driver, 'ENVIAR CÓDIGO');
  });

  it('el registro muestra errores de validación', async function () {
    await open(driver, '/register');
    await clickText(driver, 'button', 'REGISTRARSE');

    await waitText(driver, 'Este campo es obligatorio.');
    await waitText(driver, 'Debes aceptar los términos y condiciones.');
  });

  it('un usuario no autenticado es redirigido al login', async function () {
    await open(driver, '/home');

    await waitUrlContains(driver, '/login');
    await waitText(driver, 'Iniciar sesión');
  });
});
