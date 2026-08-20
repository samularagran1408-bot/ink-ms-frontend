import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { AppRole } from '../../../../core/models/app-role';
import { ChatCard, ChatCtaAccion, ChatMensajeUi, ChatResponse } from '../../../../core/models/chat';
import { ChatService } from '../../../../core/services/chat.service';
import { SessionService } from '../../../../core/services/session.service';

const STORAGE_KEY = 'inklusport.chat.conversacion_id';

@Component({
  selector: 'app-assistant-page',
  templateUrl: './assistant-page.component.html',
  styleUrl: './assistant-page.component.scss'
})
export class AssistantPageComponent implements OnInit {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLTextAreaElement>;

  mensajes: ChatMensajeUi[] = [];
  borrador = '';
  enviando = false;
  error: string | null = null;
  estadoA11y = '';
  conversacionId: string | null = null;
  mcpNota: string | null = null;

  constructor(
    private chat: ChatService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.conversacionId = sessionStorage.getItem(STORAGE_KEY);
    this.mcpNota = null;
    this.chat.describirMcp().subscribe({
      next: (info) => {
        const que = typeof info['que_es'] === 'string' ? info['que_es'] : null;
        this.mcpNota = que;
      },
      error: () => {
        this.mcpNota = null;
      }
    });
  }

  enviar(): void {
    const texto = this.borrador.trim();
    if (!texto || this.enviando) {
      return;
    }
    this.error = null;
    this.enviando = true;
    this.estadoA11y = 'Enviando mensaje al asistente';
    this.mensajes.push({ remitente: 'usuario', texto, cards: [], sugerencias: [] });
    this.borrador = '';
    this.scrollAlFinal();

    this.chat.enviar(texto, this.conversacionId).subscribe({
      next: (res) => this.aplicarRespuesta(res),
      error: (err) => {
        this.enviando = false;
        this.error = err?.error?.detail || 'No se pudo contactar al asistente.';
        this.estadoA11y = this.error || '';
      }
    });
  }

  usarSugerencia(texto: string): void {
    this.borrador = texto;
    this.enviar();
  }

  nuevaConversacion(): void {
    this.conversacionId = null;
    sessionStorage.removeItem(STORAGE_KEY);
    this.mensajes = [];
    this.error = null;
    this.estadoA11y = 'Conversación nueva';
    this.inputEl?.nativeElement.focus();
  }

  irACard(card: ChatCard): void {
    const accion = card.cta?.accion;
    if (accion === 'confirmar_write') {
      this.usarSugerencia('Confirmo');
      return;
    }
    if (accion === 'ver_estadisticas') {
      return;
    }
    if (!accion) {
      return;
    }
    const commands = this.rutaPara(accion, card.cta?.id);
    void this.router.navigate(commands.path, { queryParams: commands.query });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviar();
    }
  }

  etiquetaFuente(fuente?: string): string {
    if (fuente === 'agente') {
      return 'Agente (LLM + tools)';
    }
    return 'Motor local';
  }

  private aplicarRespuesta(res: ChatResponse): void {
    this.enviando = false;
    this.conversacionId = res.conversacion_id;
    sessionStorage.setItem(STORAGE_KEY, res.conversacion_id);
    const cards = res.cards?.length ? res.cards : [];
    this.mensajes.push({
      remitente: 'asistente',
      texto: res.respuesta,
      cards,
      sugerencias: res.sugerencias || [],
      fuente: res.fuente,
      mcp: res.mcp,
      herramientas: res.mcp?.tools_usadas?.length
        ? res.mcp.tools_usadas
        : res.herramientas_usadas
    });
    const tools = res.mcp?.llm_eligio_tools
      ? `Tools MCP: ${(res.mcp.tools_usadas || []).join(', ') || 'ninguna'}`
      : res.fuente === 'motor_local'
        ? 'Respuesta del motor local (sin tool-calling del LLM)'
        : 'Respuesta del agente';
    this.estadoA11y = `${tools}. ${res.respuesta}`;
    this.scrollAlFinal();
  }

  private rutaPara(
    accion: ChatCtaAccion,
    id?: string
  ): { path: string[]; query?: Record<string, string> } {
    const role = this.session.getPrimaryRole();
    const base = this.basePorRol(role);
    switch (accion) {
      case 'ver_eventos': {
        const eventsPath = role === 'ORGANIZADOR' || role === 'ADMIN'
          ? [`${base}/events`]
          : role === 'ENTRENADOR'
            ? ['/home/events']
            : ['/home/events'];
        return id
          ? { path: eventsPath, query: { eventoId: id } }
          : { path: eventsPath };
      }
      case 'ver_deportes':
        if (role === 'ENTRENADOR' || role === 'ADMIN') {
          return { path: [`${base === '/home' ? '/trainer' : base}/sports`] };
        }
        return { path: ['/home/events'] };
      case 'ver_sesiones':
        if (role === 'ENTRENADOR' || role === 'ADMIN') {
          return { path: ['/trainer/sessions'] };
        }
        return { path: ['/home'] };
      case 'ver_discapacidades':
        if (role === 'ADMIN') {
          return { path: ['/admin/disabilities'] };
        }
        if (role === 'ENTRENADOR') {
          return { path: ['/trainer/disabilities'] };
        }
        return { path: [`${base}/accessibility`] };
      case 'ver_quiz':
        if (role === 'ORGANIZADOR') {
          return { path: ['/organizer/quiz'] };
        }
        return { path: ['/trainer/quiz'] };
      case 'ver_perfil':
        return { path: [`${base}/profile`] };
      default:
        return { path: [base] };
    }
  }

  private basePorRol(role: AppRole): string {
    if (role === 'ADMIN') {
      return '/admin';
    }
    if (role === 'ORGANIZADOR') {
      return '/organizer';
    }
    if (role === 'ENTRENADOR') {
      return '/trainer';
    }
    return '/home';
  }

  private scrollAlFinal(): void {
    setTimeout(() => {
      const el = this.timeline?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
