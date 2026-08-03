import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

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
    RouterModule,
    TranslateModule
  ],
  exports: [
    SpaceBackgroundComponent,
    AccessibilityWidgetComponent,
    SidebarNavComponent,
    TranslateModule
  ]
})
export class SharedModule { }
