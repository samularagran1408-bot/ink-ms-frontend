describe('Páginas públicas', () => {
  it('la portada muestra la marca y las acciones de entrada', () => {
    cy.visit('/');

    cy.title().should('match', /Inklusport/i);
    cy.contains('INKLUSPORT').should('be.visible');
    cy.contains('h2', 'Bienvenido').should('be.visible');
    cy.contains('button', 'Iniciar sesión').should('be.visible');
    cy.contains('button', 'Registrarse').should('be.visible');
    cy.contains('button', 'Iniciar como invitado').should('be.visible');
  });

  it('desde la portada se navega a login, registro e invitado', () => {
    cy.visit('/');
    cy.contains('button', 'Iniciar sesión').click();
    cy.location('pathname').should('eq', '/login');
    cy.contains('h2', 'Iniciar sesión').should('be.visible');

    cy.visit('/');
    cy.contains('button', 'Registrarse').click();
    cy.location('pathname').should('eq', '/register');
    cy.contains('h2', 'Crear Cuenta').should('be.visible');

    cy.visit('/');
    cy.contains('button', 'Iniciar como invitado').click();
    cy.location('pathname').should('eq', '/guest');
    cy.contains('h1', 'LIBERTAD').should('be.visible');
  });

  it('el modo invitado muestra disciplinas y eventos', () => {
    cy.visit('/guest');

    cy.contains('h2', 'Descubre tu Disciplina').should('be.visible');
    cy.contains('h2', 'Próximos Eventos').should('be.visible');
    cy.contains('a', 'Explorar Deportes').should('be.visible');
  });
});
