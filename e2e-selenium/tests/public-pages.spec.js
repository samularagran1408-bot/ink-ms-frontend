const { expect } = require('chai');
const {
  createDriver,
  open,
  waitText,
  waitUrlContains,
  clickText,
} = require('../helpers');

describe('Páginas públicas (Selenium)', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  afterEach(async function () {
    if (driver) {
      await driver.quit();
    }
  });

  it('la portada muestra la marca y las acciones de entrada', async function () {
    await open(driver, '/');

    const title = await driver.getTitle();
    expect(title).to.match(/Inklusport/i);
    await waitText(driver, 'INKLUSPORT');
    await waitText(driver, 'Bienvenido');
    await waitText(driver, 'Iniciar sesión');
    await waitText(driver, 'Registrarse');
    await waitText(driver, 'Iniciar como invitado');
  });

  it('desde la portada se navega a login, registro e invitado', async function () {
    await open(driver, '/');
    await clickText(driver, 'button', 'Iniciar sesión');
    await waitUrlContains(driver, '/login');
    await waitText(driver, 'Iniciar sesión');

    await open(driver, '/');
    await clickText(driver, 'button', 'Registrarse');
    await waitUrlContains(driver, '/register');
    await waitText(driver, 'Crear Cuenta');

    await open(driver, '/');
    await clickText(driver, 'button', 'Iniciar como invitado');
    await waitUrlContains(driver, '/guest');
    await waitText(driver, 'LIBERTAD');
  });

  it('el modo invitado muestra disciplinas y eventos', async function () {
    await open(driver, '/guest');

    await waitText(driver, 'Descubre tu Disciplina');
    await waitText(driver, 'Próximos Eventos');
    await waitText(driver, 'Explorar Deportes');
  });
});
