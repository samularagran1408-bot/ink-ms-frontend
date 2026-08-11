import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SpaceBackgroundComponent } from './components/space-background/space-background.component';
import { AccessibilityWidgetComponent } from './components/accessibility-widget/accessibility-widget.component';
import { SidebarNavComponent } from './components/sidebar-nav/sidebar-nav.component';
import { IconComponent } from './components/icon/icon.component';
import { PlaceLocationPickerComponent } from './components/place-location-picker/place-location-picker.component';
import { EventLocationMapComponent } from './components/event-location-map/event-location-map.component';

@NgModule({
  declarations: [
    SpaceBackgroundComponent,
    AccessibilityWidgetComponent,
    SidebarNavComponent,
    IconComponent,
    PlaceLocationPickerComponent,
    EventLocationMapComponent
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
    IconComponent,
    PlaceLocationPickerComponent,
    EventLocationMapComponent,
    TranslateModule
  ]
})
export class SharedModule { }
