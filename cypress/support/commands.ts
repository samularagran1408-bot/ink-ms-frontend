declare global {
  namespace Cypress {
    interface Chainable {
      visitLoginWithDeniedAuth(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('visitLoginWithDeniedAuth', () => {
  cy.intercept('POST', '**/api/auth/login', {
    statusCode: 401,
    body: { message: 'Unauthorized' },
  }).as('loginDenied');
  cy.visit('/login');
});

export {};
