import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { SpaceBackgroundComponent } from './components/space-background/space-background.component';
import { AccessibilityWidgetComponent } from './components/accessibility-widget/accessibility-widget.component';
import { SidebarNavComponent } from './components/sidebar-nav/sidebar-nav.component';

@NgModule({
  declarations: [
    SpaceBackgroundComponent,
    AccessibilityWidgetComponent,
    SidebarNavComponent
  ],
  imports: [
    CommonModule,
    RouterModule
  ],
  exports: [
    SpaceBackgroundComponent,
    AccessibilityWidgetComponent,
    SidebarNavComponent
  ]
})
export class SharedModule { }
