import { Routes } from '@angular/router';
import { leaveClaimGuard } from './features/claim/leave-claim.guard';
import { PublicShell } from './layout/public-shell';

export const routes: Routes = [
  {
    path: '',
    component: PublicShell,
    children: [
      {
        path: '',
        title: 'Tidewell Insurance: file and track claims',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'claim',
        title: 'File a claim · Tidewell',
        canDeactivate: [leaveClaimGuard],
        loadComponent: () => import('./features/claim/claim-wizard').then((m) => m.ClaimWizard),
      },
      {
        path: 'claim/submitted/:number',
        title: 'Claim sent · Tidewell',
        loadComponent: () =>
          import('./features/claim/claim-submitted').then((m) => m.ClaimSubmitted),
      },
      {
        path: 'track',
        title: 'Track a claim · Tidewell',
        loadComponent: () => import('./features/track/track').then((m) => m.Track),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
