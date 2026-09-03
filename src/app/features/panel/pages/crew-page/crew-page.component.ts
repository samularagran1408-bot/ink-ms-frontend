import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { TimeoutError } from 'rxjs';

import { CrewDominio, CrewErrorBody, CrewRunResponse } from '../../../../core/models/crew';
import { AssistantUiService } from '../../../../core/services/assistant-ui.service';
import { CrewService } from '../../../../core/services/crew.service';

const EJEMPLOS_POR_DOMINIO: Record<string, string[]> = {
  quiz: ['¿Cuál es el umbral del quiz de organizador?'],
  consulta: ['Recomiéndame eventos'],
  investigacion: ['¿Cuántos usuarios hay?'],
  competencia: ['¿Qué plan de competencia me conviene?'],
  automatizado: ['Crea un evento Copa sandbox el 2026-09-15', 'Confirmo']
};

@Component({
  selector: 'app-crew-page',
  templateUrl: './crew-page.component.html',
  styleUrl: './crew-page.component.scss'
})
export class CrewPageComponent implements OnInit {
  catalogo: CrewDominio[] = [];
  notaAuto = '';
  rol = '';
  dominio = 'auto';
  mensaje = '';
  enviando = false;
  error: string | null = null;
  usarChat = false;
  resultado: CrewRunResponse | null = null;
  ultimoDominioEjecutado = 'auto';

  constructor(
    private crew: CrewService,
    private assistantUi: AssistantUiService
  ) {}

  ngOnInit(): void {
    this.crew.dominios().subscribe({
      next: (res) => {
        this.catalogo = res.dominios || [];
        this.notaAuto = res.auto || '';
        this.rol = res.rol || '';
      },
      error: () => {
        this.catalogo = [];
        this.error = 'No se pudo cargar el catálogo de dominios.';
      }
    });
  }

  get ejemplos(): string[] {
    const ids = new Set(this.catalogo.map((d) => d.id));
    const lista: string[] = [];
    for (const [dominio, frases] of Object.entries(EJEMPLOS_POR_DOMINIO)) {
      if (!ids.has(dominio)) {
        continue;
      }
      lista.push(...frases);
    }
    return lista;
  }

  get pendienteConfirmacion(): boolean {
    return !!this.resultado?.informe.pendiente_confirmacion;
  }

  usarEjemplo(texto: string): void {
    this.mensaje = texto;
  }

  abrirChat(): void {
    this.assistantUi.open('chat');
  }

  confirmarSandbox(): void {
    this.dominio = 'automatizado';
    this.mensaje = 'Confirmo';
    this.ejecutar();
  }

  ejecutar(): void {
    const texto = this.mensaje.trim();
    if (!texto || this.enviando) {
      return;
    }
    this.error = null;
    this.usarChat = false;
    this.enviando = true;
    this.resultado = null;
    this.ultimoDominioEjecutado = this.dominio || 'auto';

    this.crew.run(texto, this.dominio || 'auto').subscribe({
      next: (res) => {
        this.enviando = false;
        this.resultado = res;
        if (res.dominio && this.ultimoDominioEjecutado === 'auto') {
          this.dominio = res.dominio;
        }
      },
      error: (err: unknown) => {
        this.enviando = false;
        this.aplicarError(err);
      }
    });
  }

  etiquetaVia(via: string): string {
    if (via === 'mcp') {
      return 'MCP';
    }
    if (via === 'sandbox') {
      return 'Sandbox';
    }
    return 'Agente';
  }

  descripcionDominio(): string {
    if (this.dominio === 'auto') {
      return this.notaAuto;
    }
    return this.catalogo.find((d) => d.id === this.dominio)?.descripcion || '';
  }

  private aplicarError(err: unknown): void {
    if (err instanceof TimeoutError) {
      this.error = 'El crew tardó demasiado. Reintenta en un momento.';
      return;
    }
    if (!(err instanceof HttpErrorResponse)) {
      this.error = 'No se pudo ejecutar el crew.';
      return;
    }
    if (err.status === 401) {
      this.error = 'Sesión caducada. Vuelve a iniciar sesión.';
      return;
    }
    const body: CrewErrorBody = this.crew.unwrapError(err);
    if (err.status === 403) {
      this.error = body.mensaje || 'Tu rol no puede usar ese dominio.';
      if (body.dominios?.length && this.dominio !== 'auto') {
        this.dominio = 'auto';
      }
      return;
    }
    if (err.status === 422 && body.usar_chat) {
      this.usarChat = true;
      this.error = body.mensaje || 'Eso lo atiende el chat, no un crew.';
      return;
    }
    if (err.status === 422) {
      this.error = body.mensaje || 'Elige un dominio y vuelve a enviar.';
      return;
    }
    if (err.status === 503) {
      this.error = body.mensaje || 'El modelo está saturado. Espera unos minutos.';
      return;
    }
    if (err.status === 504) {
      this.error = body.mensaje || 'El crew superó el tiempo de espera.';
      return;
    }
    this.error = body.mensaje || 'No se pudo ejecutar el crew.';
  }
}
