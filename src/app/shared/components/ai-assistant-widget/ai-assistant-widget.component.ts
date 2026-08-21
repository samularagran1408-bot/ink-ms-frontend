import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { TranslateService } from '@ngx-translate/core';

import { AppRole } from '../../../core/models/app-role';
import { ChatCard, ChatCtaAccion, ChatHilo, ChatMensajeUi, ChatPasoActividad, ChatResponse, ChatStreamEvent } from '../../../core/models/chat';
import { UserProfile } from '../../../core/models/user-profile';
import { AiAssistantService } from '../../../core/services/ai-assistant.service';
import { ChatService } from '../../../core/services/chat.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ReportsService } from '../../../core/services/reports.service';
import { SessionService } from '../../../core/services/session.service';
import { UsersService } from '../../../core/services/users.service';
import { HeroIconName } from '../../icons/heroicons-outline';

type AssistantSection = 'chat' | 'rutinas' | 'riesgo' | 'competencia' | 'estadisticas';

const STORAGE_KEY = 'inklusport.chat.conversacion_id';
const PUBLIC_PATHS = new Set(['/', '', '/login', '/register', '/guest', '/forgot-password']);

@Component({
  selector: 'app-ai-assistant-widget',
  templateUrl: './ai-assistant-widget.component.html',
  styleUrl: './ai-assistant-widget.component.scss'
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
    { id: 'riesgo', labelKey: 'AI_WIDGET.TAB_RISK', icon: 'bolt' },
    { id: 'competencia', labelKey: 'AI_WIDGET.TAB_COMPETE', icon: 'trophy' },
    { id: 'estadisticas', labelKey: 'AI_WIDGET.TAB_STATS', icon: 'chart-bar' }
  ];

  mensajes: ChatMensajeUi[] = [];
  borrador = '';
  enviando = false;
  pasosAgente: ChatPasoActividad[] = [];
  errorChat: string | null = null;
  conversacionId: string | null = null;
  hilos: ChatHilo[] = [];
  historialAbierto = false;
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

  rpe: number | null = 5;
  dolor = false;
  diasSinDescanso = 0;
  cargandoRiesgo = false;
  errorRiesgo: string | null = null;
  riesgo: Record<string, unknown> | null = null;

  cargandoCompetencia = false;
  errorCompetencia: string | null = null;
  competencia: Record<string, unknown> | null = null;
  objetivoCompetencia = '';

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
    private translate: TranslateService
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
    if (id === 'estadisticas' && !this.stats && !this.cargandoStats) {
      this.cargarEstadisticas();
    }
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
    this.chatSub = this.chat.enviarConProgreso(texto, this.conversacionId, (ev) => this.onChatEvento(ev)).subscribe({
      next: (res) => this.aplicarChat(res),
      error: (err) => {
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
    this.conversacionId = null;
    sessionStorage.removeItem(STORAGE_KEY);
    this.mensajes = [];
    this.errorChat = null;
    this.chatSub?.unsubscribe();
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
    this.chat.nueva().subscribe({
      next: (res) => {
        this.conversacionId = res.conversacion_id;
        sessionStorage.setItem(STORAGE_KEY, res.conversacion_id);
        this.cargarHilos();
      }
    });
  }

  toggleHistorial(): void {
    this.historialAbierto = !this.historialAbierto;
    if (this.historialAbierto) {
      this.cargarHilos();
    }
  }

  abrirHilo(hilo: ChatHilo): void {
    if (!hilo?.conversacion_id) {
      return;
    }
    this.chatSub?.unsubscribe();
    this.enviando = false;
    this.detenerCicloLocal();
    this.pasosAgente = [];
    this.cargarHilo(hilo.conversacion_id);
  }

  async borrarHilo(event: Event, hilo: ChatHilo): Promise<void> {
    event.stopPropagation();
    if (!hilo?.conversacion_id) {
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
    this.chat.borrarHilo(hilo.conversacion_id).subscribe({
      next: () => {
        if (this.conversacionId === hilo.conversacion_id) {
          this.mensajes = [];
          this.conversacionId = null;
          sessionStorage.removeItem(STORAGE_KEY);
        }
        this.cargarHilos();
      },
      error: () => {
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      }
    });
  }

  fechaHilo(hilo: ChatHilo): string {
    const raw = hilo.ultima_interaccion || hilo.creada_en;
    if (!raw) {
      return '';
    }
    const fecha = new Date(raw);
    if (Number.isNaN(fecha.getTime())) {
      return '';
    }
    return fecha.toLocaleString(this.translate.currentLang || 'es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  tituloHiloActual(): string {
    const actual = this.hilos.find((h) => h.conversacion_id === this.conversacionId);
    return actual?.titulo || this.translate.instant('CHAT.NEW');
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
      if (!this.stats && !this.cargandoStats) {
        this.cargarEstadisticas();
      }
      return;
    }
    if (accion === 'ver_competencia') {
      this.section = 'competencia';
      if (!this.competencia && !this.cargandoCompetencia) {
        this.analizarCompetencia();
      }
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
    this.reports.exportDashboardPdf().subscribe({
      next: (blob) => this.reports.downloadBlob(blob, filename),
      error: () => {
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
        this.cargandoRutina = false;
        this.rutina = res;
      },
      error: (err) => {
        this.cargandoRutina = false;
        this.errorRutina = err?.error?.detail || 'No se pudo generar la rutina.';
      }
    });
  }

  evaluarRiesgo(): void {
    this.cargandoRiesgo = true;
    this.errorRiesgo = null;
    this.ai.evaluarRiesgo({
      rpe_reciente: this.rpe,
      dolor_reportado: this.dolor,
      dias_sin_descanso: this.diasSinDescanso
    }).subscribe({
      next: (res) => {
        this.cargandoRiesgo = false;
        this.riesgo = res;
      },
      error: (err) => {
        this.cargandoRiesgo = false;
        this.errorRiesgo = err?.error?.detail || 'No se pudo evaluar el riesgo.';
      }
    });
  }

  analizarCompetencia(): void {
    this.cargandoCompetencia = true;
    this.errorCompetencia = null;
    this.ai.analizarCompetencia().subscribe({
      next: (res) => {
        this.cargandoCompetencia = false;
        this.competencia = res;
      },
      error: (err) => {
        this.cargandoCompetencia = false;
        this.errorCompetencia = err?.error?.detail || 'No se pudo analizar la competencia.';
      }
    });
  }

  modoCompetencia(activar: boolean): void {
    this.cargandoCompetencia = true;
    this.errorCompetencia = null;
    this.ai.modoCompetencia(activar, this.objetivoCompetencia || undefined).subscribe({
      next: (res) => {
        this.cargandoCompetencia = false;
        this.competencia = res;
      },
      error: (err) => {
        this.cargandoCompetencia = false;
        this.errorCompetencia = err?.error?.detail || 'No se pudo actualizar el modo competencia.';
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

  cargarEstadisticas(usuarioId?: string, nombre?: string): void {
    this.cargandoStats = true;
    this.errorStats = null;
    this.statsObjetivoId = usuarioId || null;
    this.statsNombre = nombre || null;
    this.ai.dashboard(usuarioId).subscribe({
      next: (res) => {
        this.cargandoStats = false;
        this.stats = res;
      },
      error: (err) => {
        this.cargandoStats = false;
        this.errorStats = err?.error?.detail || 'No se pudieron cargar las estadísticas.';
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
        this.buscandoAdmin = false;
        this.usuariosAdmin = lista.slice(0, 8);
      },
      error: () => {
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

  fasesCompetencia(): Array<{ semana: string; foco: string; intensidad: string; sesiones: string; nota: string }> {
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
        nota: String(row['nota'] || '')
      };
    });
  }

  textosVista(clave: 'ventajas' | 'desventajas' | 'recomendaciones' | 'checklist' | 'riesgos'): string[] {
    const lista = this.vistaCompetencia()[clave];
    if (Array.isArray(lista) && lista.length) {
      return lista.map(String);
    }
    if (clave === 'ventajas' || clave === 'desventajas' || clave === 'recomendaciones') {
      return this.listaCompetencia(clave);
    }
    if (clave === 'checklist') {
      const directo = this.competencia?.['checklist'];
      return Array.isArray(directo) ? directo.map(String) : [];
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
    return !!this.vistaCompetencia()['activo'] || this.competencia?.['activo'] === true;
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

  private openPanel(): void {
    this.open = true;
    this.closing = false;
    this.cargarHilos();
    if (this.conversacionId && !this.mensajes.length) {
      this.cargarHilo(this.conversacionId);
    }
    setTimeout(() => this.inputEl?.nativeElement.focus(), 280);
  }

  private cargarHilos(): void {
    this.cargandoHilos = true;
    this.errorHistorial = null;
    this.chat.listarHilos().subscribe({
      next: (res) => {
        this.cargandoHilos = false;
        this.hilos = res.conversaciones || [];
      },
      error: () => {
        this.cargandoHilos = false;
        this.errorHistorial = this.translate.instant('CHAT.LOAD_ERROR');
      }
    });
  }

  private cargarHilo(conversacionId: string): void {
    this.cargandoHilo = true;
    this.errorChat = null;
    this.chat.obtenerHilo(conversacionId).subscribe({
      next: (detalle) => {
        this.cargandoHilo = false;
        this.conversacionId = detalle.conversacion_id;
        sessionStorage.setItem(STORAGE_KEY, detalle.conversacion_id);
        this.mensajes = (detalle.mensajes || []).map((m) => ({
          remitente: m.remitente === 'usuario' ? 'usuario' : 'asistente',
          texto: m.mensaje || '',
          cards: Array.isArray(m.cards) ? m.cards : [],
          sugerencias: Array.isArray(m.sugerencias) ? m.sugerencias : [],
          fuente: m.fuente
        }));
        this.historialAbierto = false;
        this.scrollChat();
      },
      error: () => {
        this.cargandoHilo = false;
        this.conversacionId = null;
        sessionStorage.removeItem(STORAGE_KEY);
        this.mensajes = [];
        this.errorChat = this.translate.instant('CHAT.LOAD_ERROR');
      }
    });
  }

  private closePanel(): void {
    this.closing = true;
    this.closeTimeout = setTimeout(() => {
      this.open = false;
      this.closing = false;
    }, 220);
  }

  private refreshVisibility(): void {
    if (!this.session.isAuthenticated()) {
      this.visible = false;
      this.open = false;
      return;
    }
    const path = (this.router.url || '/').split('?')[0];
    this.visible = !PUBLIC_PATHS.has(path);
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
      herramientas: res.mcp?.tools_usadas?.length ? res.mcp.tools_usadas : res.herramientas_usadas
    });
    this.cargarHilos();
    this.scrollChat();
  }

  private scrollChat(): void {
    setTimeout(() => {
      const el = this.timeline?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
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
