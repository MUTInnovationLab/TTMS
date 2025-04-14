import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
   },
   {
     path: 'home',
     loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
   },
  {
    path: 'lecturer',
    loadChildren: () => import('./lecturer/lecturer.module').then(m => m.LecturerPageModule)
  },
  {
    path: 'admin-dash',
    loadChildren: () => import('./admin-dash/admin-dash.module').then(m => m.AdminDashPageModule)
  },
  {
    path: 'hod-dash',
    loadChildren: () => import('./hod-dash/hod-dash.module').then(m => m.HodDashPageModule)
  },
  {
    path: 'student',
    loadChildren: () => import('./student/student.module').then(m => m.StudentPageModule)
  }
  // Add other routes as needed
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
