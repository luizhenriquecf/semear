import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CanvasModule } from 'app/components/canvas/canvas.module';

import { BookDetailsModule } from './book-details/book-details.module';
import { BooksPageRoutingModule } from './books-routing.module';
import { BooksPage } from './books.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, BooksPageRoutingModule, CanvasModule, BookDetailsModule],
  declarations: [BooksPage],
})
export class BooksPageModule {}
