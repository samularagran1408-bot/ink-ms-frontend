import { Component, OnDestroy, OnInit } from '@angular/core';
import { Location, ViewportScroller } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-terms-page',
  templateUrl: './terms-page.component.html',
  styleUrl: './terms-page.component.scss'
})
export class TermsPageComponent implements OnInit, OnDestroy {
  readonly currentYear = new Date().getFullYear();

  private fragmentSub?: Subscription;

  constructor(
    private location: Location,
    private route: ActivatedRoute,
    private viewportScroller: ViewportScroller
  ) {}

  ngOnInit(): void {
    this.viewportScroller.setOffset([0, 80]);
    this.fragmentSub = this.route.fragment.subscribe((fragment) => {
      if (!fragment) {
        return;
      }
      // Esperar a que el template pinte las secciones con id.
      requestAnimationFrame(() => {
        this.viewportScroller.scrollToAnchor(fragment);
      });
    });
  }

  ngOnDestroy(): void {
    this.fragmentSub?.unsubscribe();
  }

  goBack(): void {
    this.location.back();
  }
}
