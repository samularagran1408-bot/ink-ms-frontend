import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-panel-shell',
  templateUrl: './panel-shell.component.html',
  styleUrl: './panel-shell.component.scss'
})
export class PanelShellComponent {
  @Input() fixedSidebar = true;
}
