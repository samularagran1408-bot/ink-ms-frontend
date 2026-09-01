import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SpaceBackgroundComponent } from './components/space-background/space-background.component';
import { SidebarNavComponent } from './components/sidebar-nav/sidebar-nav.component';
import { IconComponent } from './components/icon/icon.component';
import { PlaceLocationPickerComponent } from './components/place-location-picker/place-location-picker.component';
import { EventLocationMapComponent } from './components/event-location-map/event-location-map.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { AiAssistantWidgetComponent } from './components/ai-assistant-widget/ai-assistant-widget.component';
import { BodyMapComponent } from './components/body-map/body-map.component';
import { DisabilityLabelPipe, RolesLabelPipe } from './pipes/catalog-label.pipe';

@NgModule({
  declarations: [
    SpaceBackgroundComponent,
    SidebarNavComponent,
    IconComponent,
    PlaceLocationPickerComponent,
    EventLocationMapComponent,
    ConfirmDialogComponent,
    AiAssistantWidgetComponent,
    BodyMapComponent,
    DisabilityLabelPipe,
    RolesLabelPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule
  ],
  exports: [
    SpaceBackgroundComponent,
    SidebarNavComponent,
    IconComponent,
    PlaceLocationPickerComponent,
    EventLocationMapComponent,
    ConfirmDialogComponent,
    AiAssistantWidgetComponent,
    BodyMapComponent,
    TranslateModule,
    DisabilityLabelPipe,
    RolesLabelPipe
  ]
})
export class SharedModule { }
