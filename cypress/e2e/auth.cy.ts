describe('Autenticación', () => {
  it('el login muestra error si se envía vacío', () => {
    cy.visit('/login');
    cy.contains('button', 'Acceder').click();
    cy.contains('Este campo es obligatorio.').should('be.visible');
  });

  it('el login muestra credenciales denegadas ante un 401', () => {
    cy.visitLoginWithDeniedAuth();

    cy.get('input[type="email"]').type('demo@inklusport.test');
    cy.get('.login-form input[type="password"]').type('clave-incorrecta');
    cy.contains('button', 'Acceder').click();

    cy.wait('@loginDenied');
    cy.contains('h2', 'Credenciales denegadas').should('be.visible');
    cy.contains('button', 'Reintentar').should('be.visible');
  });

  it('desde login se abre la recuperación de contraseña', () => {
    cy.visit('/login');
    cy.contains('a', '¿Olvidaste tu contraseña?').click();

    cy.location('pathname').should('eq', '/forgot-password');
    cy.contains('h2', 'Recuperación de Contraseña').should('be.visible');
    cy.contains('button', 'ENVIAR CÓDIGO').should('be.visible');
  });

  it('el registro muestra errores de validación', () => {
    cy.visit('/register');
    cy.contains('button', 'REGISTRARSE').click();

    cy.contains('Este campo es obligatorio.').should('be.visible');
    cy.contains('Debes aceptar los términos y condiciones.').should('be.visible');
  });

  it('un usuario no autenticado es redirigido al login', () => {
    cy.visit('/home');

    cy.location('pathname').should('eq', '/login');
    cy.contains('h2', 'Iniciar sesión').should('be.visible');
  });
});
