import { Component } from '@angular/core';
import { Location } from '@angular/common';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-support-page',
  templateUrl: './support-page.component.html',
  styleUrl: './support-page.component.scss'
})
export class SupportPageComponent {
  readonly supportEmail = 'soporte@inklusport.com';

  readonly faqs: FaqItem[] = [
    {
      question: '¿Cómo elijo mi rol al registrarme?',
      answer:
        'En el formulario de registro marcas si te vas a unir como Atleta Adaptado, Entrenador u Organizador. Si necesitas cambiar de rol más adelante, un Administrador puede aprobar la solicitud desde tu perfil.'
    },
    {
      question: '¿Cómo me inscribo a un evento?',
      answer:
        'Ve a "Eventos" en el menú, elige el evento y toca "Inscribirme". Si el evento tiene costo, se te pedirá completar el pago con Mercado Pago antes de confirmar el cupo.'
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer:
        'Los pagos de eventos y planes de Organizador se procesan con Mercado Pago (tarjeta de crédito o débito), en pesos colombianos (COP).'
    },
    {
      question: 'Pagué pero mi inscripción sigue como pendiente, ¿qué hago?',
      answer:
        'Mercado Pago puede tardar unos minutos en confirmar el pago. Si después de un rato sigue pendiente, revisa el historial de pagos en tu perfil; si el problema continúa, escríbenos a soporte.'
    },
    {
      question: '¿Para qué sirve el quiz de aptitud?',
      answer:
        'Es una guía breve para entrenadores y organizadores que ayuda a orientar la disciplina y el nivel de apoyo más adecuados para cada atleta, antes de sus primeras sesiones.'
    },
    {
      question: '¿Cómo ajusto el tamaño de letra, el contraste o el idioma?',
      answer:
        'Entra a tu perfil y toca "Accesibilidad". Ahí puedes cambiar el tamaño de fuente, activar alto contraste, modo lector, y elegir el idioma de la plataforma.'
    },
    {
      question: 'Olvidé mi contraseña, ¿cómo la recupero?',
      answer:
        'En la pantalla de inicio de sesión toca "¿Olvidaste tu contraseña?" y sigue los pasos: te enviaremos un código de verificación a tu correo registrado.'
    },
    {
      question: '¿Cómo contacto al organizador de un evento?',
      answer:
        'Dentro del detalle del evento encuentras la información de contacto y ubicación publicada por el organizador.'
    }
  ];

  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
