import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AppRole } from '@core/models/app-role';
import { ChatCard, ChatCtaAccion, ChatHilo, ChatLimites, ChatMensajeUi, ChatPasoActividad, ChatResponse, ChatStreamEvent } from '@features/assistant/models/chat';
import { BodyMapData } from '@features/assistant/models/body-map';
import { ChatService } from '@features/assistant/services/chat.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { SessionService } from '@core/services/session.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { HeroIconName } from '@shared/icons/heroicons-outline';
import { SharedModule } from '@shared/shared.module';

const STORAGE_KEY = 'inklusport.chat.conversacion_id';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-assistant-page',
  templateUrl: './assistant-page.component.html',
  styleUrl: './assistant-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantPageComponent implements OnInit, OnDestroy {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLTextAreaElement>;

  mensajes: ChatMensajeUi[] = [];
  borrador = '';
  limitacion = '';
  enviando = false;
  pasosAgente: ChatPasoActividad[] = [];
  error: string | null = null;
  estadoA11y = '';
  conversacionId: string | null = null;
  mcpNota: string | null = null;
  hilos: ChatHilo[] = [];
  hilosVisibles: ChatHilo[] = [];
  cargandoHilos = false;
  cargandoHilo = false;
  errorHistorial: string | null = null;
  limites: ChatLimites = { maxMensajesPorChat: 40, maxChatsActivos: 10 };

  private chatSub?: Subscription;
  private cicloLocal?: ReturnType<typeof setInterval>;
  private actividadReal = false;

  constructor(
    private chat: ChatService,
    private session: SessionService,
    private reports: ReportsService,
    private router: Router,
    private confirm: ConfirmDialogService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.conversacionId = sessionStorage.getItem(STORAGE_KEY);
    this.mcpNota = null;
    this.cargarHilos(true);
    this.chat.describirMcp().subscribe({
      next: (info) => {
        const que = typeof info['que_es'] === 'string' ? info['que_es'] : null;
        this.mcpNota = que;
        this.cdr.markForCheck();
      },
      error: () => {
        this.mcpNota = null;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.chatSub?.unsubscribe();
    this.detenerCicloLocal();
  }

  enviar(): void {
    const texto = this.borrador.trim();
    if (!texto || this.enviando || this.cargandoHilo) {
      return;
    }
    this.error = null;
    this.enviando = true;
    this.estadoA11y = 'Enviando mensaje al asistente';
    this.mensajes.push({ remitente: 'usuario', texto, cards: [], sugerencias: [] });
    this.borrador = '';
    this.iniciarAnimacionEspera();
    this.scrollAlFinal();

    this.chatSub?.unsubscribe();
    this.chatSub = this.chat.enviarConProgreso(texto, this.conversacionId, (ev) => this.onChatEvento(ev), this.limitacion).subscribe({
      next: (res) => this.aplicarRespuesta(res),
      error: (err) => {
        this.enviando = false;
        this.detenerCicloLocal();
        this.pasosAgente = [];
        this.error = err?.error?.detail || err?.message || 'No se pudo contactar al asistente.';
        if (typeof this.error !== 'string') {
          this.error = 'No se pudo contactar al asistente.';
        }
        if (err?.status === 429) {
          this.error = (typeof err?.error?.detail === 'string' && err.error.detail)
            || 'Ya hay una respuesta en curso. Espera un momento.';
        }
        this.estadoA11y = this.error || '';
        this.cdr.markForCheck();
      }
    });
  }

  usarSugerencia(texto: string): void {
    this.borrador = texto;
    this.enviar();
  }

  nuevaConversacion(): void {
    this.conversacionId = this.chat.idNuevo();
    sessionStorage.setItem(STORAGE_KEY, this.conversacionId);
    this.mensajes = [];
    this.error = null;
    this.estadoA11y = 'Conversación nueva';
    this.chatSub?.unsubscribe();
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
    this.inputEl?.nativeElement.focus();
    this.chat.nueva().subscribe({
      next: (res) => {
        const cid = res.conversacion_id || (res as { session_id?: string }).session_id;
        if (!cid) {
          return;
        }
        this.conversacionId = cid;
        sessionStorage.setItem(STORAGE_KEY, cid);
        this.cdr.markForCheck();
      }
    });
  }

  filtrarHistorial(): void {
    this.hilosVisibles = [...this.hilos];
    this.cdr.markForCheck();
  }

  trackByHilo(_index: number, hilo: ChatHilo): string {
    return this.chat.idDeHilo(hilo) || String(_index);
  }

  trackByMensaje(index: number, msg: ChatMensajeUi): string {
    return `${index}:${msg.remitente}:${msg.texto.slice(0, 32)}`;
  }

  trackByCard(index: number, card: ChatCard): string {
    return `${card.tipo}:${card.titulo}:${index}`;
  }

  trackBySugerencia(index: number, texto: string): string {
    return texto || String(index);
  }

  trackByPaso(index: number, paso: ChatPasoActividad): string {
    return `${paso.tipo}:${paso.code}:${index}`;
  }

  labelPaso(paso: ChatPasoActividad): string {
    return paso.mensaje || paso.code.replace(/_/g, ' ');
  }

  iconoPaso(paso: ChatPasoActividad): HeroIconName {
    if (paso.estado === 'listo') {
      return 'shield-check';
    }
    if (paso.tipo === 'herramienta') {
      return 'bolt';
    }
    return 'sparkles';
  }

  idDeHilo(hilo: ChatHilo): string {
    return this.chat.idDeHilo(hilo);
  }

  tituloDeHilo(hilo: ChatHilo | null | undefined): string {
    const titulo = String(hilo?.titulo || '').trim();
    if (titulo) {
      return titulo;
    }
    return this.translate.instant('CHAT.NEW');
  }

  tituloHiloActual(): string {
    const actual = this.hilos.find((h) => this.chat.idDeHilo(h) === this.conversacionId);
    return this.tituloDeHilo(actual) || this.translate.instant('CHAT.NEW');
  }

  abrirHilo(hilo: ChatHilo): void {
    const cid = this.chat.idDeHilo(hilo);
    if (!cid) {
      this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      return;
    }
    this.cargarHilo(cid);
  }

  async borrarHilo(event: Event, hilo: ChatHilo): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const cid = this.chat.idDeHilo(hilo);
    if (!cid) {
      this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      return;
    }
    const ok = await this.confirm.ask({
      title: this.translate.instant('CHAT.DELETE_TITLE'),
      message: this.translate.instant('CHAT.DELETE_CONFIRM'),
      confirmLabel: this.translate.instant('CHAT.DELETE'),
      cancelLabel: this.translate.instant('COMMON.CANCEL') || 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.chat.borrarHilo(cid).subscribe({
      next: () => {
        if (this.conversacionId === cid) {
          this.mensajes = [];
          this.conversacionId = this.chat.idNuevo();
          sessionStorage.setItem(STORAGE_KEY, this.conversacionId);
        }
        this.cargarHilos();
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  async borrarTodoHistorial(): Promise<void> {
    if (!this.hilos.length) {
      return;
    }
    const ok = await this.confirm.ask({
      title: this.translate.instant('CHAT.DELETE_ALL_TITLE'),
      message: this.translate.instant('CHAT.DELETE_ALL_CONFIRM'),
      confirmLabel: this.translate.instant('CHAT.DELETE_ALL'),
      cancelLabel: this.translate.instant('COMMON.CANCEL') || 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.chat.borrarTodos().subscribe({
      next: () => {
        this.hilos = [];
        this.hilosVisibles = [];
        this.mensajes = [];
        this.conversacionId = this.chat.idNuevo();
        sessionStorage.setItem(STORAGE_KEY, this.conversacionId);
        this.errorHistorial = null;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  fechaCorta(valor: unknown): string {
    if (!valor) {
      return '—';
    }
    const fecha = new Date(String(valor));
    if (Number.isNaN(fecha.getTime())) {
      return String(valor);
    }
    return fecha.toLocaleString();
  }

  irACard(card: ChatCard): void {
    const accion = card.cta?.accion;
    if (accion === 'confirmar_write') {
      this.usarSugerencia('Confirmo');
      return;
    }
    if (accion === 'descargar_pdf') {
      const filename = card.cta?.filename || `inklusport-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`;
      this.reports.exportDashboardPdf().subscribe({
        next: (blob) => this.reports.downloadBlob(blob, filename),
        error: () => {
          this.error = 'No se pudo descargar el PDF.';
          this.cdr.markForCheck();
        }
      });
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

  private cargarHilos(abrirActual = false): void {
    this.cargandoHilos = true;
    this.errorHistorial = null;
    this.chat.listarHilos().subscribe({
      next: (res) => {
        this.cargandoHilos = false;
        const delServidor = res.conversaciones || [];
        if (res.limites) {
          this.limites = res.limites;
        }
        if (delServidor.length) {
          this.hilos = delServidor;
        }
        this.filtrarHistorial();
        if (!abrirActual || this.mensajes.length) {
          return;
        }
        const guardado = this.conversacionId && this.hilos.some((h) => this.chat.idDeHilo(h) === this.conversacionId)
          ? this.conversacionId
          : this.chat.idDeHilo(this.hilos[0]);
        if (guardado) {
          this.cargarHilo(guardado);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargandoHilos = false;
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  private cargarHilo(conversacionId: string): void {
    this.cargandoHilo = true;
    this.error = null;
    this.chat.obtenerHilo(conversacionId).subscribe({
      next: (detalle) => {
        this.cargandoHilo = false;
        const cid = this.chat.idDeHilo(detalle) || conversacionId;
        this.conversacionId = cid;
        sessionStorage.setItem(STORAGE_KEY, cid);
        this.mensajes = this.chat.mapearMensajes(detalle);
        if (detalle.limites) {
          this.limites = detalle.limites;
        }
        this.scrollAlFinal();
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargandoHilo = false;
        this.error = this.translate.instant('CHAT.LOAD_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  private aplicarRespuesta(res: ChatResponse): void {
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
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
        : res.herramientas_usadas,
      cuerpo: this.cuerpoDe(res)
    });
    this.upsertHiloLocal(res);
    this.cargarHilos();
    const tools = res.mcp?.llm_eligio_tools
      ? `Tools MCP: ${(res.mcp.tools_usadas || []).join(', ') || 'ninguna'}`
      : res.fuente === 'motor_local'
        ? 'Respuesta del motor local (sin tool-calling del LLM)'
        : 'Respuesta del agente';
    this.estadoA11y = `${tools}. ${res.respuesta}`;
    this.scrollAlFinal();
    this.cdr.markForCheck();
  }

  private upsertHiloLocal(res: ChatResponse): void {
    const cid = res.conversacion_id;
    if (!cid) {
      return;
    }
    const idx = this.hilos.findIndex((h) => this.chat.idDeHilo(h) === cid);
    const now = new Date().toISOString();
    if (idx >= 0) {
      const actual = this.hilos[idx];
      const actualizado: ChatHilo = {
        ...actual,
        ultima_interaccion: now,
        total_mensajes: (actual.total_mensajes || 0) + 2
      };
      this.hilos = [actualizado, ...this.hilos.filter((_, i) => i !== idx)];
    } else {
      this.hilos = [
        {
          conversacion_id: cid,
          titulo: (this.mensajes.find((m) => m.remitente === 'usuario')?.texto || '').trim().slice(0, 60)
            || this.translate.instant('CHAT.NEW'),
          estado: 'activa',
          ultima_interaccion: now,
          total_mensajes: this.mensajes.length + 1
        },
        ...this.hilos
      ];
    }
    this.filtrarHistorial();
  }

  private onChatEvento(ev: ChatStreamEvent): void {
    if (ev.evento === 'respuesta' || ev.evento === 'fin') {
      return;
    }
    if (ev.evento === 'herramienta' || (ev.evento === 'estado' && ev.detalle !== 'analizando_intencion')) {
      this.actividadReal = true;
      this.detenerCicloLocal();
    }
    const code = ev.detalle || ev.evento;
    const estado = (ev.estado === 'listo' ? 'listo' : 'ejecutando') as ChatPasoActividad['estado'];
    const existente = this.pasosAgente.find((p) => p.code === code && p.tipo === (ev.evento === 'herramienta' ? 'herramienta' : 'estado'));
    if (existente) {
      existente.estado = estado;
      existente.mensaje = ev.mensaje || existente.mensaje;
      this.pasosAgente = [...this.pasosAgente];
    } else {
      this.completarPasoActual();
      this.pasosAgente = [
        ...this.pasosAgente,
        {
          tipo: ev.evento === 'herramienta' ? 'herramienta' : 'estado',
          code,
          estado,
          mensaje: ev.mensaje
        }
      ];
    }
    this.scrollAlFinal();
    this.cdr.markForCheck();
  }

  private iniciarAnimacionEspera(): void {
    this.actividadReal = false;
    this.detenerCicloLocal();
    this.pasosAgente = [
      { tipo: 'estado', code: 'analizando_intencion', estado: 'ejecutando', mensaje: 'Entendiendo tu mensaje…' }
    ];
    const extras: ChatPasoActividad[] = [
      { tipo: 'estado', code: 'agente_con_tools', estado: 'ejecutando', mensaje: 'Decidiendo qué consultar…' },
      { tipo: 'estado', code: 'redactando_respuesta', estado: 'ejecutando', mensaje: 'Redactando la respuesta…' }
    ];
    let i = 0;
    this.cicloLocal = setInterval(() => {
      if (this.actividadReal || !this.enviando || i >= extras.length) {
        this.detenerCicloLocal();
        return;
      }
      this.completarPasoActual();
      this.pasosAgente = [...this.pasosAgente, extras[i]];
      i += 1;
      this.scrollAlFinal();
      this.cdr.markForCheck();
    }, 1600);
  }

  private completarPasoActual(): void {
    this.pasosAgente = this.pasosAgente.map((paso) =>
      paso.estado === 'ejecutando' ? { ...paso, estado: 'listo' } : paso
    );
  }

  private detenerCicloLocal(): void {
    if (this.cicloLocal) {
      clearInterval(this.cicloLocal);
      this.cicloLocal = undefined;
    }
  }

  private cuerpoDe(res: ChatResponse): BodyMapData | null {
    if (res.cuerpo && typeof res.cuerpo === 'object') {
      return res.cuerpo;
    }
    const raw = res.datos?.['cuerpo'];
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return raw as BodyMapData;
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
      case 'ver_usuarios':
        return id
          ? { path: ['/admin/users', id] }
          : { path: ['/admin/users'] };
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
