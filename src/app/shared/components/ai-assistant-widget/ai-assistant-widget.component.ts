import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { TranslateService } from '@ngx-translate/core';

import { AppRole } from '@core/models/app-role';
import { ChatCard, ChatCtaAccion, ChatHilo, ChatMensajeUi, ChatPasoActividad, ChatResponse, ChatStreamEvent } from '@features/assistant/models/chat';
import { BodyMapData } from '@features/assistant/models/body-map';
import { UserProfile } from '@core/models/user-profile';
import { AiAssistantService } from '@features/assistant/services/ai-assistant.service';
import { AssistantSection, AssistantUiService } from '@features/assistant/services/assistant-ui.service';
import { ChatService } from '@features/assistant/services/chat.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { CompetitionProgressService } from '@features/assistant/services/competition-progress.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { SessionService } from '@core/services/session.service';
import { UsersService } from '@features/users/services/users.service';
import { HeroIconName } from '../../icons/heroicons-outline';

const STORAGE_KEY = 'inklusport.chat.conversacion_id';
const PUBLIC_PATHS = new Set(['/', '', '/login', '/register', '/guest', '/forgot-password']);

@Component({
  selector: 'app-ai-assistant-widget',
  templateUrl: './ai-assistant-widget.component.html',
  styleUrl: './ai-assistant-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiAssistantWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLTextAreaElement>;

  visible = false;
  open = false;
  closing = false;
  section: AssistantSection = 'chat';

  readonly tabs: { id: AssistantSection; labelKey: string; icon: HeroIconName }[] = [
    { id: 'chat', labelKey: 'AI_WIDGET.TAB_CHAT', icon: 'chat-bubble-left-right' },
    { id: 'rutinas', labelKey: 'AI_WIDGET.TAB_ROUTINES', icon: 'heart' },
    { id: 'planes', labelKey: 'AI_WIDGET.TAB_PLANS', icon: 'clipboard-document-list' },
    { id: 'riesgo', labelKey: 'AI_WIDGET.TAB_RISK', icon: 'bolt' },
    { id: 'competencia', labelKey: 'AI_WIDGET.TAB_COMPETE', icon: 'trophy' },
    { id: 'estadisticas', labelKey: 'AI_WIDGET.TAB_STATS', icon: 'chart-bar' }
  ];

  mensajes: ChatMensajeUi[] = [];
  borrador = '';
  limitacion = '';
  enviando = false;
  pasosAgente: ChatPasoActividad[] = [];
  errorChat: string | null = null;
  conversacionId: string | null = null;
  hilos: ChatHilo[] = [];
  hilosVisibles: ChatHilo[] = [];
  cargandoHilos = false;
  cargandoHilo = false;
  errorHistorial: string | null = null;
  private chatSub?: Subscription;
  private cicloLocal?: ReturnType<typeof setInterval>;
  private actividadReal = false;

  rutinaObjetivo = 'fuerza';
  rutinaTipo = 'general';
  rutinaMinutos = 30;
  cargandoRutina = false;
  errorRutina: string | null = null;
  rutina: Record<string, unknown> | null = null;

  planObjetivo = 'fuerza';
  planSemanas = 4;
  planSesiones = 3;
  planMinutos = 35;
  planNivel = 'principiante';
  cargandoPlan = false;
  errorPlan: string | null = null;
  plan: Record<string, unknown> | null = null;
  planes: Array<Record<string, unknown>> = [];
  planSesionAbierta: string | null = null;

  rpe: number | null = 5;
  dolor = false;
  diasSinDescanso = 0;
  cargandoRiesgo = false;
  errorRiesgo: string | null = null;
  riesgo: Record<string, unknown> | null = null;
  historialRiesgo: Array<Record<string, unknown>> = [];
  cargandoHistorialRiesgo = false;
  errorHistorialRiesgo: string | null = null;

  cargandoCompetencia = false;
  errorCompetencia: string | null = null;
  competencia: Record<string, unknown> | null = null;
  objetivoCompetencia = '';
  loggingChecklistId: string | null = null;
  loggingRoutineId: string | null = null;

  cargandoStats = false;
  errorStats: string | null = null;
  stats: Record<string, unknown> | null = null;
  busquedaAdmin = '';
  usuariosAdmin: UserProfile[] = [];
  statsNombre: string | null = null;
  statsObjetivoId: string | null = null;
  buscandoAdmin = false;

  private closeTimeout?: ReturnType<typeof setTimeout>;
  private subs = new Subscription();

  constructor(
    private session: SessionService,
    private router: Router,
    private chat: ChatService,
    private ai: AiAssistantService,
    private users: UsersService,
    private reports: ReportsService,
    private confirm: ConfirmDialogService,
    private translate: TranslateService,
    private competitionProgress: CompetitionProgressService,
    private assistantUi: AssistantUiService,
    private liveSync: LiveSyncService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.conversacionId = sessionStorage.getItem(STORAGE_KEY);
    this.refreshVisibility();
    this.subs.add(this.session.profile$.subscribe(() => this.refreshVisibility()));
    this.subs.add(this.session.roles$.subscribe(() => this.refreshVisibility()));
    this.subs.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.refreshVisibility())
    );
    this.subs.add(this.assistantUi.openSection$.subscribe((id) => {
      this.section = id;
      if (!this.open) {
        this.openPanel();
      }
      if (id === 'competencia' && !this.cargandoCompetencia) {
        this.cargarEstadoCompetencia();
      }
      if (id === 'estadisticas' && !this.cargandoStats) {
        this.cargarEstadisticas(this.statsObjetivoId || undefined, this.statsNombre || undefined);
      }
      if (id === 'planes' && !this.plan && !this.cargandoPlan) {
        this.cargarPlanes();
      }
      if (id === 'riesgo' && !this.cargandoHistorialRiesgo) {
        this.cargarHistorialRiesgo();
      }
      if (id === 'chat') {
        this.cargarHilos();
      }
      this.cdr.markForCheck();
    }));
    this.subs.add(this.competitionProgress.raw$.subscribe((raw) => {
      if (raw && (raw['activo'] || raw['vista'])) {
        this.competencia = raw;
      }
      this.cdr.markForCheck();
    }));
    this.liveSync.start();
    this.subs.add(this.liveSync.pulse$.subscribe(() => this.onLiveSync()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.chatSub?.unsubscribe();
    this.detenerCicloLocal();
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.state$.value) {
      return;
    }
    if (this.open) {
      this.closePanel();
    }
  }

  toggle(): void {
    if (this.open) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  selectSection(id: AssistantSection): void {
    this.section = id;
    if (id === 'chat') {
      this.cargarHilos();
    }
    if (id === 'estadisticas' && !this.cargandoStats) {
      this.cargarEstadisticas(this.statsObjetivoId || undefined, this.statsNombre || undefined);
    }
    if (id === 'competencia' && !this.cargandoCompetencia) {
      this.cargarEstadoCompetencia();
    }
    if (id === 'planes') {
      this.cargarPlanes();
    }
    if (id === 'riesgo') {
      this.cargarHistorialRiesgo();
    }
    this.cdr.markForCheck();
  }

  enviarChat(): void {
    const texto = this.borrador.trim();
    if (!texto || this.enviando || this.cargandoHilo) {
      return;
    }
    this.errorChat = null;
    this.enviando = true;
    this.mensajes.push({ remitente: 'usuario', texto, cards: [], sugerencias: [] });
    this.borrador = '';
    this.iniciarAnimacionEspera();
    this.scrollChat();
    this.chatSub?.unsubscribe();
    this.chatSub = this.chat.enviarConProgreso(texto, this.conversacionId, (ev) => this.onChatEvento(ev), this.limitacion).subscribe({
      next: (res) => this.aplicarChat(res),
      error: (err) => {
        this.cdr.markForCheck();
        this.enviando = false;
        this.detenerCicloLocal();
        this.pasosAgente = [];
        this.errorChat = err?.error?.detail || err?.message || 'No se pudo contactar al asistente.';
      }
    });
  }

  usarSugerencia(texto: string): void {
    this.borrador = texto;
    this.enviarChat();
  }

  nuevaConversacion(): void {
    this.conversacionId = this.chat.idNuevo();
    sessionStorage.setItem(STORAGE_KEY, this.conversacionId);
    this.mensajes = [];
    this.errorChat = null;
    this.chatSub?.unsubscribe();
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
    this.chat.nueva().subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        const cid = this.chat.idDeHilo(res) || res.conversacion_id || (res as { session_id?: string }).session_id;
        if (!cid) {
          return;
        }
        this.conversacionId = cid;
        sessionStorage.setItem(STORAGE_KEY, cid);
        this.cargarHilos();
      }
    });
  }

  filtrarHistorial(): void {
    this.hilosVisibles = [...this.hilos];
    this.cdr.markForCheck();
  }

  trackByHilo(_index: number, hilo: ChatHilo): string {
    return this.idDeHilo(hilo) || String(_index);
  }

  trackByTab(_index: number, tab: { id: AssistantSection }): string {
    return tab.id;
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

  abrirHilo(event: Event, hilo: ChatHilo): void {
    event.preventDefault();
    event.stopPropagation();
    const cid = this.idDeHilo(hilo);
    if (!cid) {
      this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      return;
    }
    this.chatSub?.unsubscribe();
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
    this.cargarHilo(cid);
  }

  async borrarHilo(event: Event, hilo: ChatHilo): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const cid = this.idDeHilo(hilo);
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
        this.cdr.markForCheck();
        if (this.conversacionId === cid) {
          this.mensajes = [];
          this.conversacionId = this.chat.idNuevo();
          sessionStorage.setItem(STORAGE_KEY, this.conversacionId);
        }
        this.cargarHilos();
      },
      error: () => {
        this.cdr.markForCheck();
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      }
    });
  }

  async borrarTodoHistorial(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
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
        this.cdr.markForCheck();
        this.hilos = [];
        this.hilosVisibles = [];
        this.mensajes = [];
        this.conversacionId = this.chat.idNuevo();
        sessionStorage.setItem(STORAGE_KEY, this.conversacionId);
        this.errorHistorial = null;
      },
      error: () => {
        this.cdr.markForCheck();
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      }
    });
  }

  idDeHilo(hilo: ChatHilo | Record<string, unknown> | null | undefined): string {
    return this.chat.idDeHilo(hilo);
  }

  private normalizarHilo(hilo: ChatHilo): ChatHilo {
    return this.chat.normalizarHilo(hilo);
  }

  tituloHiloActual(): string {
    const actual = this.hilos.find((h) => this.idDeHilo(h) === this.conversacionId);
    return this.tituloDeHilo(actual) || this.translate.instant('CHAT.NEW');
  }

  tituloDeHilo(hilo: ChatHilo | null | undefined): string {
    const titulo = String(hilo?.titulo || '').trim();
    if (titulo) {
      return titulo;
    }
    return this.translate.instant('CHAT.NEW');
  }

  onChatKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarChat();
    }
  }

  irACard(card: ChatCard): void {
    const accion = card.cta?.accion;
    if (accion === 'confirmar_write') {
      this.usarSugerencia('Confirmo');
      return;
    }
    if (accion === 'descargar_pdf') {
      this.descargarPdf(card);
      return;
    }
    if (accion === 'ver_estadisticas') {
      this.section = 'estadisticas';
      this.cargarEstadisticas();
      return;
    }
    if (accion === 'ver_competencia') {
      this.section = 'competencia';
      if (!this.competencia && !this.cargandoCompetencia) {
        this.analizarCompetencia();
      }
      return;
    }
    if (accion === 'ver_planes') {
      this.section = 'planes';
      this.cargarPlanes();
      return;
    }
    if (!accion) {
      return;
    }
    const commands = this.rutaPara(accion, card.cta?.id);
    this.closePanel();
    void this.router.navigate(commands.path, { queryParams: commands.query });
  }

  private descargarPdf(card: ChatCard): void {
    const filename = card.cta?.filename || `inklusport-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`;
    const url = card.cta?.url || '/api/dashboard/export/pdf';
    const kind = (card.cta?.kind || '').toLowerCase();
    const esAuditoria =
      kind === 'auditoria' || url.includes('audit') || url.includes('analysis') || filename.includes('audit');
    if (esAuditoria) {
      this.descargarPdfAuditoria(filename, url.includes('analysis') || kind === 'auditoria');
      return;
    }
    this.reports.exportDashboardPdf().subscribe({
      next: (blob) => this.reports.downloadBlob(blob, filename),
      error: () => {
        this.cdr.markForCheck();
        this.errorChat = 'No se pudo descargar el PDF.';
      }
    });
  }

  private descargarPdfAuditoria(filename: string, analisis: boolean): void {
    this.users.getAuditLogs().subscribe({
      next: (logs) => {
        this.cdr.markForCheck();
        const payload = {
          logs: (logs || []).map((log) => ({
            id: log.id,
            adminEmail: log.adminEmail,
            action: log.action,
            targetEmail: log.targetEmail,
            targetUserId: log.targetUserId,
            details: log.details,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt
          }))
        };
        const req$ = analisis
          ? this.reports.exportAnalysisPdf(payload)
          : this.reports.exportAuditPdf(payload);
        req$.subscribe({
          next: (blob) => this.reports.downloadBlob(blob, filename),
          error: () => {
        this.cdr.markForCheck();
            this.errorChat = 'No se pudo descargar el PDF.';
          }
        });
      },
      error: () => {
        this.cdr.markForCheck();
        this.errorChat = 'No se pudo descargar el PDF.';
      }
    });
  }

  generarRutina(): void {
    this.cargandoRutina = true;
    this.errorRutina = null;
    this.ai.generarRutina({
      objetivo: this.rutinaObjetivo,
      tipo: this.rutinaTipo,
      duracion_minutos: this.rutinaMinutos
    }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoRutina = false;
        this.rutina = res;
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoRutina = false;
        this.errorRutina = err?.error?.detail || 'No se pudo generar la rutina.';
      }
    });
  }

  generarPlan(): void {
    this.cargandoPlan = true;
    this.errorPlan = null;
    this.planSesionAbierta = null;
    this.ai.generarPlan({
      objetivo: this.planObjetivo,
      semanas: this.planSemanas,
      sesiones_por_semana: this.planSesiones,
      duracion_minutos: this.planMinutos,
      nivel: this.planNivel
    }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoPlan = false;
        this.plan = res;
        const id = res['plan_id'];
        this.planes = [res, ...this.planes.filter((p) => p['plan_id'] !== id)];
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoPlan = false;
        this.errorPlan = err?.error?.detail || 'No se pudo generar el plan.';
      }
    });
  }

  cargarPlanes(): void {
    this.cargandoPlan = true;
    this.errorPlan = null;
    this.ai.listarPlanes().subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoPlan = false;
        const lista = res['planes'];
        this.planes = Array.isArray(lista) ? lista as Array<Record<string, unknown>> : [];
        if (!this.plan && this.planes.length) {
          this.plan = this.planes[0];
        }
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoPlan = false;
        this.errorPlan = err?.error?.detail || 'No se pudieron cargar los planes.';
      }
    });
  }

  verPlan(item: Record<string, unknown>): void {
    this.plan = item;
    this.planSesionAbierta = null;
  }

  sesionesPlan(): Array<Record<string, unknown>> {
    const lista = this.plan?.['sesiones'];
    return Array.isArray(lista) ? lista as Array<Record<string, unknown>> : [];
  }

  semanasPlan(): number[] {
    return [...new Set(this.sesionesPlan().map((s) => Number(s['semana'] || 0)).filter((n) => n > 0))];
  }

  sesionesDeSemana(semana: number): Array<Record<string, unknown>> {
    return this.sesionesPlan().filter((s) => Number(s['semana']) === semana);
  }

  claveSesionPlan(sesion: Record<string, unknown>): string {
    return String(sesion['id'] || `${sesion['semana']}-${sesion['sesion']}`);
  }

  esSesionAbierta(sesion: Record<string, unknown>): boolean {
    return this.planSesionAbierta === this.claveSesionPlan(sesion);
  }

  toggleSesionPlan(sesion: Record<string, unknown>): void {
    const clave = this.claveSesionPlan(sesion);
    this.planSesionAbierta = this.planSesionAbierta === clave ? null : clave;
  }

  ejerciciosDeSesion(sesion: Record<string, unknown>): Array<Record<string, unknown>> {
    const directo = sesion['ejercicios'];
    if (Array.isArray(directo) && directo.length) {
      return directo as Array<Record<string, unknown>>;
    }
    const bloques = sesion['bloques'];
    if (!Array.isArray(bloques)) {
      return [];
    }
    const planos: Array<Record<string, unknown>> = [];
    for (const bloque of bloques) {
      const row = bloque && typeof bloque === 'object' ? bloque as Record<string, unknown> : {};
      const lista = row['ejercicios'];
      if (!Array.isArray(lista)) {
        continue;
      }
      for (const ej of lista) {
        if (ej && typeof ej === 'object') {
          planos.push(ej as Record<string, unknown>);
        }
      }
    }
    return planos;
  }


  evaluarRiesgo(): void {
    this.cargandoRiesgo = true;
    this.errorRiesgo = null;
    this.ai.evaluarRiesgo({
      rpe_reciente: this.rpe == null ? null : Number(this.rpe),
      dolor_reportado: this.dolor,
      dias_sin_descanso: this.diasSinDescanso,
      limitacion: this.limitacion
    }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoRiesgo = false;
        this.riesgo = res;
        this.cargarHistorialRiesgo();
        this.cargarEstadisticas(this.statsObjetivoId || undefined, this.statsNombre || undefined, true);
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoRiesgo = false;
        this.errorRiesgo = this.httpErrorDetail(err, 'No se pudo evaluar el riesgo.');
      }
    });
  }

  cargarEstadoCompetencia(silent = false): void {
    if (this.loggingChecklistId || this.loggingRoutineId) {
      return;
    }
    if (!silent) {
      this.cargandoCompetencia = true;
      this.errorCompetencia = null;
    }
    this.ai.obtenerModo().subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoCompetencia = false;
        this.competencia = res;
        this.competitionProgress.publish(res);
      },
      error: () => {
        this.cdr.markForCheck();
        if (this.competenciaModoActivo() && this.checklistItems().length) {
          this.cargandoCompetencia = false;
          return;
        }
        this.analizarCompetencia();
      }
    });
  }

  analizarCompetencia(): void {
    this.cargandoCompetencia = true;
    this.errorCompetencia = null;
    this.ai.analizarCompetencia().subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoCompetencia = false;
        if (this.competenciaModoActivo() && this.checklistItems().length) {
          return;
        }
        this.competencia = res;
        this.competitionProgress.publish(res);
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoCompetencia = false;
        this.errorCompetencia = this.httpErrorDetail(err, 'No se pudo analizar la competencia.');
      }
    });
  }

  modoCompetencia(activar: boolean): void {
    this.cargandoCompetencia = true;
    this.errorCompetencia = null;
    this.ai.modoCompetencia(activar, this.objetivoCompetencia || undefined).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoCompetencia = false;
        this.competencia = res;
        this.competitionProgress.publish(res);
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoCompetencia = false;
        this.errorCompetencia = this.httpErrorDetail(err, 'No se pudo actualizar el modo competencia.');
        this.cargarEstadoCompetencia(true);
      }
    });
  }

  toggleChecklist(item: { id: string; hecho: boolean }): void {
    if (!item?.id || this.loggingChecklistId || !this.competenciaModoActivo()) {
      return;
    }
    this.loggingChecklistId = item.id;
    this.errorCompetencia = null;
    this.competitionProgress.marcarChecklist(item.id, !item.hecho).subscribe({
      next: () => {
        this.cdr.markForCheck();
        this.loggingChecklistId = null;
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.loggingChecklistId = null;
        this.errorCompetencia = this.httpErrorDetail(err, 'No se pudo actualizar la lista del plan.');
      }
    });
  }

  registrarSesionRutina(routineId: string): void {
    if (!routineId || this.loggingRoutineId || !this.competenciaModoActivo()) {
      return;
    }
    this.loggingRoutineId = routineId;
    this.errorCompetencia = null;
    this.competitionProgress.registrarSesion(routineId).subscribe({
      next: () => {
        this.cdr.markForCheck();
        this.loggingRoutineId = null;
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.loggingRoutineId = null;
        this.errorCompetencia = this.httpErrorDetail(err, 'No se pudo registrar la sesión.');
      }
    });
  }

  esAdmin(): boolean {
    return this.session.hasRole('ADMIN');
  }

  esOrganizador(): boolean {
    return this.session.hasRole('ORGANIZADOR', 'ADMIN');
  }

  esEntrenador(): boolean {
    return this.session.hasRole('ENTRENADOR', 'ADMIN');
  }

  cargarEstadisticas(usuarioId?: string, nombre?: string, silent = false): void {
    if (!silent) {
      this.cargandoStats = true;
      this.errorStats = null;
    }
    this.statsObjetivoId = usuarioId || this.statsObjetivoId;
    this.statsNombre = nombre || this.statsNombre;
    this.ai.dashboard(usuarioId || this.statsObjetivoId || undefined).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoStats = false;
        this.stats = res;
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoStats = false;
        this.errorStats = this.httpErrorDetail(err, 'No se pudieron cargar las estadísticas.');
      }
    });
  }

  buscarUsuariosAdmin(): void {
    const q = this.busquedaAdmin.trim();
    if (!q || !this.esAdmin()) {
      this.usuariosAdmin = [];
      return;
    }
    this.buscandoAdmin = true;
    this.users.searchUsers(q).subscribe({
      next: (lista) => {
        this.cdr.markForCheck();
        this.buscandoAdmin = false;
        this.usuariosAdmin = lista.slice(0, 8);
      },
      error: () => {
        this.cdr.markForCheck();
        this.buscandoAdmin = false;
        this.usuariosAdmin = [];
      }
    });
  }

  verStatsDe(user: UserProfile): void {
    this.busquedaAdmin = user.fullName || '';
    this.usuariosAdmin = [];
    this.cargarEstadisticas(user.id, user.fullName);
  }

  vistaStats(): Record<string, unknown> {
    const raw = this.stats?.['vista'];
    return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  }

  perfilVista(): { nombre: string; discapacidad: string; roles: string[] } {
    const p = this.vistaStats()['perfil'] as Record<string, unknown> | undefined;
    const roles = p?.['roles'];
    return {
      nombre: String(p?.['nombre'] || this.statsNombre || this.session.getDisplayName()),
      discapacidad: String(p?.['discapacidad'] || '—'),
      roles: Array.isArray(roles) ? roles.map(String) : []
    };
  }

  kpisVista(): Array<{ clave: string; icono: HeroIconName; valor: string; label: string }> {
    const lista = this.vistaStats()['kpis'];
    if (!Array.isArray(lista) || !lista.length) {
      const insc = this.inscripciones();
      return [
        { clave: 'eventos', icono: 'calendar-days', valor: String(insc.eventos), label: 'Eventos inscritos' },
        { clave: 'rutinas', icono: 'heart', valor: String(insc.rutinas), label: 'Rutinas inscritas' }
      ];
    }
    return lista.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        clave: String(row['clave'] || ''),
        icono: this.iconoSeguro(row['icono']),
        valor: String(row['valor'] ?? '—'),
        label: String(row['label'] || row['clave'] || '')
      };
    });
  }

  comparativaVista(): Array<{ label: string; actual: number; anterior: number; delta: number }> {
    const lista = this.vistaStats()['comparativa'];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        label: String(row['label'] || ''),
        actual: Number(row['actual'] || 0),
        anterior: Number(row['anterior'] || 0),
        delta: Number(row['delta'] || 0)
      };
    });
  }

  itemsVista(clave: 'eventos' | 'rutinas'): Array<{ titulo: string; subtitulo: string; meta: string[] }> {
    const lista = this.vistaStats()[clave];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item) => {
      const row = item as Record<string, unknown>;
      const meta = Array.isArray(row['meta']) ? row['meta'].map(String) : [];
      return {
        titulo: String(row['titulo'] || ''),
        subtitulo: String(row['subtitulo'] || ''),
        meta
      };
    });
  }

  tendenciaVista(): string {
    return String(this.vistaStats()['tendencia'] || '');
  }

  sesionesHistorialVista(): Array<{ fecha: string; rpe: string }> {
    const lista = this.vistaStats()['sesiones_historial'];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        fecha: this.fechaCorta(row['fecha']),
        rpe: String(row['rpe'] ?? '—')
      };
    });
  }

  competenciaActiva(): boolean {
    return !!this.vistaStats()['modo_competencia'];
  }

  iconoSeguro(valor: unknown): HeroIconName {
    const name = String(valor || 'chart-bar');
    const allowed: HeroIconName[] = [
      'calendar-days', 'heart', 'bolt', 'shield-check', 'chart-bar',
      'trophy', 'users', 'user', 'exclamation-triangle', 'sparkles',
      'clipboard-document-list'
    ];
    return allowed.includes(name as HeroIconName) ? name as HeroIconName : 'chart-bar';
  }

  iconoCard(tipo: string): HeroIconName {
    if (tipo === 'evento') return 'calendar-days';
    if (tipo === 'deporte') return 'trophy';
    if (tipo === 'rutina' || tipo === 'ejercicio') return 'heart';
    if (tipo === 'usuario') return 'user';
    if (tipo === 'kpi') return 'chart-bar';
    if (tipo === 'quiz') return 'academic-cap';
    if (tipo === 'confirmacion') return 'plus';
    if (tipo === 'reporte') return 'clipboard-document-list';
    return 'sparkles';
  }

  textoBurbuja(texto: string): string {
    const t = (texto || '').trim();
    if ((t.startsWith('{') || t.startsWith('[')) && t.length > 40) {
      return 'Te dejo el resumen en las tarjetas, sin el bloque técnico.';
    }
    return texto;
  }

  lineasBurbuja(texto: string): string[] {
    const t = this.textoBurbuja(texto).replace(/\r\n/g, '\n').trim();
    if (!t) {
      return [];
    }
    const porSalto = t.split(/\n+/).map((linea) => linea.trim()).filter(Boolean);
    if (porSalto.length > 1) {
      return porSalto;
    }
    const oraciones = porSalto[0].split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/);
    if (oraciones.length >= 3) {
      return oraciones.map((linea) => linea.trim()).filter(Boolean);
    }
    return porSalto;
  }

  sugerenciasRol(): string[] {
    if (this.esAdmin()) {
      return [
        'Bloquea a un usuario por nombre',
        'Exporta el dashboard a PDF',
        'Lista los usuarios inactivos'
      ];
    }
    if (this.esOrganizador()) {
      return ['Propón un evento para publicar', '¿Qué eventos hay?', 'Crea un evento de natación'];
    }
    if (this.esEntrenador()) {
      return ['Guarda una rutina en la plataforma', 'Alta de un deporte', '¿Qué rutinas tengo?'];
    }
    return ['¿Cómo va mi progreso?', '¿Qué hay en mi perfil?', 'Pídeme una rutina adaptada'];
  }

  ejerciciosRutina(): Array<Record<string, unknown>> {
    const lista = this.rutina?.['ejercicios'];
    return Array.isArray(lista) ? lista as Array<Record<string, unknown>> : [];
  }

  bloquesRutina(): Array<Record<string, unknown>> {
    const lista = this.rutina?.['bloques'];
    return Array.isArray(lista) ? lista as Array<Record<string, unknown>> : [];
  }

  factoresRiesgo(): string[] {
    const lista = this.riesgo?.['factores'];
    return Array.isArray(lista) ? lista.map(String) : [];
  }

  recomendacionesRiesgo(): string[] {
    const lista = this.riesgo?.['recomendaciones'];
    return Array.isArray(lista) ? lista.map(String) : [];
  }

  cargarHistorialRiesgo(): void {
    this.cargandoHistorialRiesgo = true;
    this.errorHistorialRiesgo = null;
    this.ai.historialRiesgo().subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoHistorialRiesgo = false;
        const lista = res['evaluaciones'];
        this.historialRiesgo = Array.isArray(lista) ? lista as Array<Record<string, unknown>> : [];
      },
      error: () => {
        this.cdr.markForCheck();
        this.cargandoHistorialRiesgo = false;
        this.errorHistorialRiesgo = 'No se pudo cargar el historial de riesgo.';
      }
    });
  }

  async borrarEvaluacionRiesgo(item: Record<string, unknown>): Promise<void> {
    const id = String(item['id'] || '');
    if (!id) {
      return;
    }
    const ok = await this.confirm.ask({
      title: this.translate.instant('AI_WIDGET.RISK_DELETE_TITLE'),
      message: this.translate.instant('AI_WIDGET.RISK_DELETE_ONE'),
      confirmLabel: this.translate.instant('CHAT.DELETE'),
      cancelLabel: this.translate.instant('COMMON.CANCEL') || 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.ai.borrarEvaluacionRiesgo(id).subscribe({
      next: () => this.cargarHistorialRiesgo(),
      error: () => {
        this.cdr.markForCheck();
        this.errorHistorialRiesgo = 'No se pudo borrar esa evaluación.';
      }
    });
  }

  async vaciarHistorialRiesgo(): Promise<void> {
    if (!this.historialRiesgo.length) {
      return;
    }
    const ok = await this.confirm.ask({
      title: this.translate.instant('AI_WIDGET.RISK_DELETE_TITLE'),
      message: this.translate.instant('AI_WIDGET.RISK_DELETE_ALL'),
      confirmLabel: this.translate.instant('CHAT.DELETE'),
      cancelLabel: this.translate.instant('COMMON.CANCEL') || 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.ai.vaciarHistorialRiesgo().subscribe({
      next: () => {
        this.cdr.markForCheck();
        this.historialRiesgo = [];
        this.riesgo = null;
      },
      error: () => {
        this.cdr.markForCheck();
        this.errorHistorialRiesgo = 'No se pudo vaciar el historial.';
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

  alertasStats(): string[] {
    const vista = this.vistaStats()['alertas'];
    if (Array.isArray(vista) && vista.length) {
      return vista.map(String);
    }
    const lista = this.stats?.['alertas_sugeridas'];
    return Array.isArray(lista) ? lista.map(String) : [];
  }

  nivelRiesgoClass(): string {
    const nivel = String(this.riesgo?.['nivel'] || '').toLowerCase();
    if (nivel === 'alto') {
      return 'ai-badge--alto';
    }
    if (nivel === 'moderado') {
      return 'ai-badge--medio';
    }
    return 'ai-badge--bajo';
  }

  asText(value: unknown): string {
    if (value == null) {
      return '—';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }

  vistaCompetencia(): Record<string, unknown> {
    const raw = this.competencia?.['vista'];
    return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  }

  kpisCompetencia(): Array<{ clave: string; icono: HeroIconName; valor: string; label: string }> {
    const lista = this.vistaCompetencia()['kpis'];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        clave: String(row['clave'] || ''),
        icono: this.iconoSeguro(row['icono']),
        valor: String(row['valor'] ?? '—'),
        label: String(row['label'] || row['clave'] || '')
      };
    });
  }

  fasesCompetencia(): Array<{
    semana: string;
    foco: string;
    intensidad: string;
    sesiones: string;
    nota: string;
    actual: boolean;
  }> {
    const lista = this.vistaCompetencia()['fases'];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        semana: String(row['semana'] ?? ''),
        foco: String(row['foco'] || ''),
        intensidad: String(row['intensidad'] || ''),
        sesiones: String(row['sesiones'] ?? ''),
        nota: String(row['nota'] || ''),
        actual: !!row['actual']
      };
    });
  }

  checklistItems(): Array<{ id: string; texto: string; hecho: boolean }> {
    const lista = this.vistaCompetencia()['checklist'] || this.competencia?.['checklist'];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item, index) => {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return {
          id: String(row['id'] || `c${index + 1}`),
          texto: String(row['texto'] || row['text'] || ''),
          hecho: !!row['hecho']
        };
      }
      return { id: `c${index + 1}`, texto: String(item), hecho: false };
    }).filter((item) => !!item.texto);
  }

  rutinasInscritas(): Array<{ id: string; nombre: string }> {
    const lista = this.vistaCompetencia()['rutinas_inscritas'] || this.competencia?.['rutinas_inscritas'];
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.map((item) => {
      const row = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
      return {
        id: String(row['id'] || ''),
        nombre: String(row['nombre'] || 'Rutina')
      };
    }).filter((item) => !!item.id);
  }

  textosVista(clave: 'ventajas' | 'desventajas' | 'recomendaciones' | 'checklist' | 'riesgos'): string[] {
    if (clave === 'checklist') {
      return this.checklistItems().map((item) => item.texto);
    }
    const lista = this.vistaCompetencia()[clave];
    if (Array.isArray(lista) && lista.length) {
      return lista.map(String);
    }
    if (clave === 'ventajas' || clave === 'desventajas' || clave === 'recomendaciones') {
      return this.listaCompetencia(clave);
    }
    if (clave === 'riesgos') {
      const directo = this.competencia?.['riesgos'];
      return Array.isArray(directo) ? directo.map(String) : [];
    }
    return [];
  }

  eventoObjetivoVista(): { titulo: string; subtitulo: string; meta: string[] } | null {
    const raw = this.vistaCompetencia()['evento_objetivo'];
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const row = raw as Record<string, unknown>;
    const meta = Array.isArray(row['meta']) ? row['meta'].map(String) : [];
    return {
      titulo: String(row['titulo'] || ''),
      subtitulo: String(row['subtitulo'] || ''),
      meta
    };
  }

  notaCompetencia(): string {
    const vista = this.vistaCompetencia();
    const nota = vista['nota'] || this.competencia?.['nota'] || this.competencia?.['mensaje'];
    return typeof nota === 'string' && nota.trim() ? nota : '';
  }

  objetivoVista(): string {
    const valor = this.vistaCompetencia()['objetivo'] || this.competencia?.['objetivo'];
    return typeof valor === 'string' && valor.trim() ? valor : '';
  }

  competenciaModoActivo(): boolean {
    return !!this.vistaCompetencia()['activo']
      || this.competencia?.['activo'] === true
      || !!this.competitionProgress.snapshot?.activo;
  }

  labelPaso(paso: ChatPasoActividad): string {
    return paso.mensaje || paso.code.replace(/_/g, ' ');
  }

  labelTool(nombre: string): string {
    return (nombre || '').replace(/_/g, ' ');
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

  inscripciones(): { eventos: number; rutinas: number } {
    const raw = this.stats?.['inscripciones'] as Record<string, unknown> | undefined;
    return {
      eventos: Number(raw?.['total_eventos'] || 0),
      rutinas: Number(raw?.['total_rutinas'] || 0)
    };
  }

  listaCompetencia(clave: string): string[] {
    const fuente = this.competencia?.['analisis'] as Record<string, unknown> | undefined;
    const base = this.competencia?.['analisis_base'] as Record<string, unknown> | undefined;
    const directo = this.competencia?.[clave];
    const lista = Array.isArray(directo) ? directo : fuente?.[clave] || base?.[clave];
    return Array.isArray(lista) ? lista.map(String) : [];
  }

  private onLiveSync(): void {
    if (this.section === 'estadisticas' || this.stats) {
      this.cargarEstadisticas(this.statsObjetivoId || undefined, this.statsNombre || undefined, true);
    }
    if (this.section === 'competencia' || this.competenciaModoActivo()) {
      this.cargarEstadoCompetencia(true);
    }
    this.cdr.markForCheck();
  }

  private httpErrorDetail(err: unknown, fallback: string): string {
    const detail = (err as { error?: { detail?: unknown; message?: string } })?.error?.detail
      ?? (err as { error?: { message?: string } })?.error?.message;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (item && typeof item === 'object') {
            const row = item as { msg?: string; message?: string };
            return row.msg || row.message || '';
          }
          return '';
        })
        .filter((part) => !!part);
      if (parts.length) {
        return parts.join(' ');
      }
    }
    if (detail && typeof detail === 'object') {
      const row = detail as { msg?: string; message?: string };
      if (row.msg || row.message) {
        return String(row.msg || row.message);
      }
    }
    return fallback;
  }

  private openPanel(): void {
    this.open = true;
    this.closing = false;
    this.cargarHilos(true);
    setTimeout(() => this.inputEl?.nativeElement.focus(), 280);
    this.cdr.markForCheck();
  }

  private cargarHilos(abrirActual = false): void {
    this.cargandoHilos = true;
    this.errorHistorial = null;
    this.chat.listarHilos().subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.cargandoHilos = false;
        this.hilos = (res.conversaciones || [])
          .filter((hilo): hilo is ChatHilo => !!hilo && typeof hilo === 'object')
          .map((hilo) => this.normalizarHilo(hilo));
        this.filtrarHistorial();
        if (!abrirActual || this.mensajes.length) {
          return;
        }
        const guardado = this.conversacionId && this.hilos.some((h) => this.idDeHilo(h) === this.conversacionId)
          ? this.conversacionId
          : this.idDeHilo(this.hilos[0]);
        if (guardado) {
          this.cargarHilo(guardado);
        }
      },
      error: (err) => {
        this.cdr.markForCheck();
        this.cargandoHilos = false;
        this.errorHistorial = this.httpErrorDetail(err, this.translate.instant('CHAT.LOAD_ERROR'));
      }
    });
  }

  private cargarHilo(conversacionId: string): void {
    this.cargandoHilo = true;
    this.errorChat = null;
    this.chat.obtenerHilo(conversacionId).subscribe({
      next: (detalle) => {
        this.cdr.markForCheck();
        this.cargandoHilo = false;
        const cid = this.idDeHilo(detalle) || conversacionId;
        this.conversacionId = cid;
        sessionStorage.setItem(STORAGE_KEY, cid);
        this.mensajes = this.chat.mapearMensajes(detalle);
        this.scrollChat();
      },
      error: () => {
        this.cdr.markForCheck();
        this.cargandoHilo = false;
        this.errorChat = this.translate.instant('CHAT.LOAD_ERROR');
      }
    });
  }

  private closePanel(): void {
    this.closing = true;
    this.closeTimeout = setTimeout(() => {
      this.open = false;
      this.closing = false;
      this.cdr.markForCheck();
    }, 220);
    this.cdr.markForCheck();
  }

  private refreshVisibility(): void {
    if (!this.session.isAuthenticated()) {
      this.visible = false;
      this.open = false;
      this.cdr.markForCheck();
      return;
    }
    const path = (this.router.url || '/').split('?')[0];
    this.visible = !PUBLIC_PATHS.has(path);
    this.cdr.markForCheck();
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
    this.scrollChat();
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
      this.scrollChat();
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

  private aplicarChat(res: ChatResponse): void {
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
    this.conversacionId = res.conversacion_id;
    sessionStorage.setItem(STORAGE_KEY, res.conversacion_id);
    this.mensajes.push({
      remitente: 'asistente',
      texto: res.respuesta,
      cards: res.cards || [],
      sugerencias: res.sugerencias || [],
      fuente: res.fuente,
      mcp: res.mcp,
      herramientas: res.mcp?.tools_usadas?.length ? res.mcp.tools_usadas : res.herramientas_usadas,
      cuerpo: this.cuerpoDe(res)
    });
    this.upsertHiloLocal(res);
    this.scrollChat();
    this.cdr.markForCheck();
  }

  private upsertHiloLocal(res: ChatResponse): void {
    const cid = res.conversacion_id;
    if (!cid) {
      return;
    }
    const idx = this.hilos.findIndex((h) => this.idDeHilo(h) === cid);
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
          titulo: '',
          estado: 'activa',
          ultima_interaccion: now,
          total_mensajes: this.mensajes.length
        },
        ...this.hilos
      ];
    }
    this.filtrarHistorial();
  }

  private scrollChat(): void {
    setTimeout(() => {
      const el = this.timeline?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }

  cuerpoDeRiesgo(): BodyMapData | null {
    const raw = this.riesgo?.['cuerpo'];
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return raw as BodyMapData;
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
          : ['/home/events'];
        return id ? { path: eventsPath, query: { eventoId: id } } : { path: eventsPath };
      }
      case 'ver_deportes':
        if (role === 'ENTRENADOR' || role === 'ADMIN') {
          return { path: [`${base === '/home' ? '/trainer' : base}/sports`] };
        }
        return { path: ['/home/events'] };
      case 'ver_sesiones':
        return role === 'ENTRENADOR' || role === 'ADMIN'
          ? { path: ['/trainer/sessions'] }
          : { path: ['/home'] };
      case 'ver_discapacidades':
        if (role === 'ADMIN') {
          return { path: ['/admin/disabilities'] };
        }
        if (role === 'ENTRENADOR') {
          return { path: ['/trainer/disabilities'] };
        }
        return { path: [`${base}/accessibility`] };
      case 'ver_quiz':
        return { path: [role === 'ORGANIZADOR' ? '/organizer/quiz' : '/trainer/quiz'] };
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
}
