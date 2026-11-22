import { Routes } from '@angular/router';
import { signedOutGuard, staffGuard } from './core/auth';
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
  {
    path: 'staff/sign-in',
    title: 'Staff sign in · Tidewell',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./features/staff/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'staff',
    canActivate: [staffGuard],
    loadComponent: () => import('./features/staff/staff-shell').then((m) => m.StaffShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'claims' },
      {
        path: 'claims',
        title: 'Claims queue · Tidewell staff',
        loadComponent: () => import('./features/staff/claims-queue').then((m) => m.ClaimsQueue),
      },
      {
        path: 'claims/:id',
        title: 'Claim · Tidewell staff',
        loadComponent: () => import('./features/staff/claim-detail').then((m) => m.ClaimDetail),
      },
      {
        path: 'activity',
        title: 'Activity log · Tidewell staff',
        loadComponent: () => import('./features/staff/activity-log').then((m) => m.ActivityLog),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
