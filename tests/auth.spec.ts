import { test, expect } from '@playwright/test';

test.describe('Autenticación', () => {
  test('el login muestra error si se envía vacío', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Acceder' }).click();

    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
  });

  test('el login muestra credenciales denegadas ante un 401', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    await page.goto('/login');
    await page.getByPlaceholder('juan@ejemplo.com').fill('demo@inklusport.test');
    await page.locator('.login-form input[type="password"]').fill('clave-incorrecta');
    await page.getByRole('button', { name: 'Acceder' }).click();

    await expect(page.getByRole('heading', { name: 'Credenciales denegadas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('desde login se abre la recuperación de contraseña', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'Recuperación de Contraseña' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ENVIAR CÓDIGO' })).toBeVisible();
  });

  test('el registro muestra errores de validación', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: 'REGISTRARSE' }).click();

    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
    await expect(page.getByText('Debes aceptar los términos y condiciones.')).toBeVisible();
  });

  test('un usuario no autenticado es redirigido al login', async ({ page }) => {
    await page.goto('/home');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
