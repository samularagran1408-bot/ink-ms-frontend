import { test, expect } from '@playwright/test';

test.describe('Páginas públicas', () => {
  test('la portada muestra la marca y las acciones de entrada', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Inklusport/i);
    await expect(page.getByText('INKLUSPORT').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrarse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar como invitado' })).toBeVisible();
  });

  test('desde la portada se navega a login, registro e invitado', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Crear Cuenta' })).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Iniciar como invitado' }).click();
    await expect(page).toHaveURL(/\/guest$/);
    await expect(page.getByRole('heading', { name: /LIBERTAD/ })).toBeVisible();
  });

  test('el modo invitado muestra disciplinas y eventos', async ({ page }) => {
    await page.goto('/guest');

    await expect(page.getByRole('heading', { name: 'Descubre tu Disciplina' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Próximos Eventos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explorar Deportes' })).toBeVisible();
  });
});
