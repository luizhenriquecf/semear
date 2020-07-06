import { Component, OnInit, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-canvas-painter',
  templateUrl: './canvas-painter.page.html',
  styles: ['canvas { border: 1px solid #000; background: #fff}']
})
export class CanvasPainterPage implements OnInit {
  private PAINT_START: string;
  private PAINT_MOVE: string;
  private PAINT_END: string;

  @ViewChild('canvas', { static: true }) canvas: ElementRef;
  @ViewChild('canvasDynamic', { static: true }) canvasDynamic: ElementRef;

  @Input()
  public canvasWidth = '600px';
  @Input()
  public canvasHeight = '600px';
  @Input()
  public color = '#000000';
  @Input()
  public lineWidth = 10;
  @Input()
  public cacheSize = 10;
  @Input()
  public clipBounds: any = { x: 0, y: 0, width: 0, height: 0 };

  @Output()
  public paintStart: EventEmitter<void> = new EventEmitter<void>();
  @Output()
  public paintEnd: EventEmitter<void> = new EventEmitter<void>();
  @Output()
  public undoLength: EventEmitter<number> = new EventEmitter<number>();
  @Output()
  public redoLength: EventEmitter<number> = new EventEmitter<number>();
  @Output()
  public isEmpty: EventEmitter<boolean> = new EventEmitter<boolean>();

  private _isTouch: boolean;
  private _mouseDown: boolean;
  private _undoCache: Array<any> = [];
  private _redoCache: Array<any> = [];
  private _deletedFromUndoCache = false;
  private _isEmpty = true;
  private _point: any = { x: 0, y: 0 };
  private _ppts: Array<any> = [];
  private _ctx: any;
  private _ctxDynamic: any;

  constructor() {}

  ngOnInit() {
    this._isTouch = !!('ontouchstart' in window);

    this.PAINT_START = this._isTouch ? 'touchstart' : 'mousedown';
    this.PAINT_MOVE = this._isTouch ? 'touchmove' : 'mousemove';
    this.PAINT_END = this._isTouch ? 'touchend' : 'mouseup';

    this._ctx = this.canvas.nativeElement.getContext('2d');
    this._ctxDynamic = this.canvasDynamic.nativeElement.getContext('2d');

    this.initListeners();

    this.undoLength.emit(0);
    this.redoLength.emit(0);
    this.isEmpty.emit(true);
  }

  public undo(): void {
    if (this._undoCache.length > 0) {
      this._redoCache.push(this._ctx.getImageData(0, 0, this.canvasDynamic.nativeElement.width, this.canvasDynamic.nativeElement.height));
      this._ctx.putImageData(this._undoCache.pop(), 0, 0);
      this.undoLength.emit(this._undoCache.length);
      this.redoLength.emit(this._redoCache.length);
      if (!this._deletedFromUndoCache && !this._undoCache.length) {
        this.setIsEmpty(true);
      }
    }
  }

  public redo(): void {
    if (this._redoCache.length > 0) {
      this._undoCache.push(this._ctx.getImageData(0, 0, this.canvasDynamic.nativeElement.width, this.canvasDynamic.nativeElement.height));
      this._ctx.putImageData(this._redoCache.pop(), 0, 0);
      this.undoLength.emit(this._undoCache.length);
      this.redoLength.emit(this._redoCache.length);
      this.setIsEmpty(false);
    }
  }

  public wipe(): void {
    this._ctx.clearRect(0, 0, this.canvasDynamic.nativeElement.width, this.canvasDynamic.nativeElement.height);
    this._ctxDynamic.clearRect(0, 0, this.canvasDynamic.nativeElement.width, this.canvasDynamic.nativeElement.height);
    if (this._undoCache.length > 0) {
      this._undoCache.splice(0, this._undoCache.length);
      this.undoLength.emit(0);
    }
    this.setIsEmpty(true);
    this._deletedFromUndoCache = false;
    if (this._redoCache.length > 0) {
      this._redoCache.splice(0, this._redoCache.length);
      this.redoLength.emit(0);
    }
  }

  public getImageData(): string {
    return this.canvas.nativeElement.toDataURL();
  }

  private getOffset(elem: any): any {
    const bbox: any = elem.getBoundingClientRect();
    return {
      left: bbox.left,
      top: bbox.top
    };
  }

  private initListeners(): void {
    this.canvasDynamic.nativeElement.addEventListener(this.PAINT_START, this._paintStartHandler, false);
    this.canvasDynamic.nativeElement.addEventListener(this.PAINT_END, this._paintEndHandler, false);

    if (!this._isTouch) {
      document.body.addEventListener('mousedown', this._downHandler);
      document.body.addEventListener('mouseup', this._upHandler);

      // scope.$on('$destroy', removeEventListeners);

      this.canvasDynamic.nativeElement.addEventListener('mouseenter', this._enterHandler);
      this.canvasDynamic.nativeElement.addEventListener('mouseleave', this._leaveHandler);
    }
  }

  private removeEventListeners(): void {
    document.body.removeEventListener('mousedown', this._downHandler);
    document.body.removeEventListener('mouseup', this._upHandler);
  }

  private copyTmpImage(): void {
    this._undoCache.push(this._ctx.getImageData(0, 0, this.canvasDynamic.nativeElement.width, this.canvasDynamic.nativeElement.height));
    if (this._undoCache.length > this.cacheSize) {
      this._undoCache = this._undoCache.slice(-1 * this.cacheSize);
      this._deletedFromUndoCache = true;
    } else {
      this.undoLength.emit(this._undoCache.length);
    }
    this.setIsEmpty(false);
    if (this._redoCache.length) {
      this._redoCache.splice(0, this._redoCache.length);
      this.redoLength.emit(0);
    }
    this._ctxDynamic.restore();

    this.canvasDynamic.nativeElement.removeEventListener(this.PAINT_MOVE, this._moveHandler, false);
    this._ctx.drawImage(this.canvasDynamic.nativeElement, 0, 0);
    this._ctxDynamic.clearRect(0, 0, this.canvasDynamic.nativeElement.width, this.canvasDynamic.nativeElement.height);
    this._ppts = [];

    this.paintEnd.emit();
  }

  private startTmpImage(e: any): void {
    e.preventDefault();

    this.paintStart.emit();

    this.canvasDynamic.nativeElement.addEventListener(this.PAINT_MOVE, this._moveHandler, false);

    this.setPointFromEvent(this._point, e);
    this._ppts.push({
      x: this._point.x,
      y: this._point.y
    });
    this._ppts.push({
      x: this._point.x,
      y: this._point.y
    });

    this.paint(e);
  }

  private setPointFromEvent(point: any, e: any): void {
    if (this._isTouch) {
      point.x = e.changedTouches[0].pageX - this.getOffset(e.target).left;
      point.y = e.changedTouches[0].pageY - this.getOffset(e.target).top;
    } else {
      point.x = e.offsetX !== undefined ? e.offsetX : e.layerX;
      point.y = e.offsetY !== undefined ? e.offsetY : e.layerY;
    }
  }

  private paint(e: any): void {
    if (e) {
      e.preventDefault();
      this.setPointFromEvent(this._point, e);
    }

    // Saving all the points in an array
    this._ppts.push({
      x: this._point.x,
      y: this._point.y
    });

    if (this._ppts.length === 3) {
      const b: any = this._ppts[0];

      this._ctxDynamic.lineJoin = this._ctxDynamic.lineCap = 'round';
      this._ctxDynamic.fillStyle = this.color;

      this._ctxDynamic.save();
      this.clip();
      this._ctxDynamic.beginPath();
      this._ctxDynamic.arc(b.x, b.y, this._ctxDynamic.lineWidth / 2, 0, Math.PI * 2, !0);
      this._ctxDynamic.fill();
      this._ctxDynamic.closePath();
      this._ctxDynamic.restore();
      return;
    }

    // Tmp canvas is always cleared up before drawing.
    this._ctxDynamic.clearRect(0, 0, `this.canvasDynamic.nativeElement.width`, this.canvasDynamic.nativeElement.height);

    this._ctxDynamic.save();
    this.clip();
    this._ctxDynamic.beginPath();
    this._ctxDynamic.moveTo(this._ppts[0].x, this._ppts[0].y);

    let i = 1;
    for (i; i < this._ppts.length - 2; i++) {
      const c: any = (this._ppts[i].x + this._ppts[i + 1].x) / 2;
      const d: any = (this._ppts[i].y + this._ppts[i + 1].y) / 2;
      this._ctxDynamic.quadraticCurveTo(this._ppts[i].x, this._ppts[i].y, c, d);
    }

    // For the last 2 points
    this._ctxDynamic.quadraticCurveTo(this._ppts[i].x, this._ppts[i].y, this._ppts[i + 1].x, this._ppts[i + 1].y);

    this._ctxDynamic.lineJoin = this._ctxDynamic.lineCap = 'round';
    this._ctxDynamic.lineWidth = this.lineWidth;
    this._ctxDynamic.strokeStyle = this.color;

    this._ctxDynamic.stroke();
    this._ctxDynamic.restore();
  }

  private _downHandler: any = (e: any) => {
    this.mousedown();
  };

  private _moveHandler: any = (e: any) => {
    this.paint(e);
  };

  private _upHandler: any = (e: any) => {
    this.mouseup();
  };

  private _paintStartHandler: any = (e: any) => {
    this.startTmpImage(e);
  };

  private _paintEndHandler: any = (e: any) => {
    this.copyTmpImage();
  };

  private _enterHandler: any = (e: any) => {
    this.mouseenter(e);
  };

  private _leaveHandler: any = (e: any) => {
    this.mouseleave(e);
  };

  private clip(): void {
    if (
      this.clipBounds &&
      null != this.clipBounds &&
      this.clipBounds.x >= 0 &&
      this.clipBounds.y >= 0 &&
      this.clipBounds.width > 0 &&
      this.clipBounds.height > 0
    ) {
      this._ctxDynamic.beginPath();
      this._ctxDynamic.rect(this.clipBounds.x, this.clipBounds.y, this.clipBounds.width, this.clipBounds.height);
      this._ctxDynamic.clip();
    }
  }

  private mousedown() {
    this._mouseDown = true;
  }

  private mouseup() {
    this._mouseDown = false;
  }

  private mouseenter(e: any): void {
    // If the mouse is down when it enters the canvas, start a path
    if (this._mouseDown) {
      this.startTmpImage(e);
    }
  }

  private mouseleave(e: any): void {
    // If the mouse is down when it leaves the canvas, end the path
    if (this._mouseDown) {
      this.copyTmpImage();
    }
  }

  private setIsEmpty(isEmpty: boolean) {
    if (this._isEmpty !== isEmpty) {
      this.isEmpty.emit(isEmpty);
      this._isEmpty = isEmpty;
    }
  }
}
