import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type AssistantSection = 'chat' | 'rutinas' | 'planes' | 'riesgo' | 'competencia' | 'estadisticas';

@Injectable({ providedIn: 'root' })
export class AssistantUiService {
  private readonly openSectionSubject = new Subject<AssistantSection>();
  readonly openSection$ = this.openSectionSubject.asObservable();

  open(section: AssistantSection = 'chat'): void {
    this.openSectionSubject.next(section);
  }
}
