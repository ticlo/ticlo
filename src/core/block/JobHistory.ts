import debounce from 'lodash/debounce';
import {DataMap} from '../util/DataTypes';
import {/*type*/ Job} from './Job';
import {deepEqual} from '../util/Compare';

export class JobHistory {
  _history: DataMap[];
  _current = 0;

  _hasUndo = false;
  _hasRedo = false;

  checkUndoRedo() {
    let hasUndo = this._current > 0 || this._tracking;
    if (hasUndo !== this._hasUndo) {
      this._hasUndo = hasUndo;
      this.job.updateValue('@has-undo', hasUndo || undefined); // true or undefined
    }

    let hasRedo = this._current < this._history.length - 1;
    if (hasRedo !== this._hasRedo) {
      this._hasRedo = hasRedo;
      this.job.updateValue('@has-redo', hasRedo || undefined); // true or undefined
    }
  }

  constructor(public job: Job) {
    this._history = [job.save()];
  }

  undo() {
    if (this._tracking) {
      // if _trackChangeCallback is not called yet, undo to the current saved state
      this.job.liveUpdate(this._history[this._current]);
      this.cancelTrack();
      this.checkUndoRedo();
    } else if (this._current > 0) {
      --this._current;
      this.job.liveUpdate(this._history[this._current]);
      this.checkUndoRedo();
    }
  }

  redo() {
    if (this._current < this._history.length - 1) {
      ++this._current;
      this.job.liveUpdate(this._history[this._current]);
      this.cancelTrack();
      this.checkUndoRedo();
    }
  }

  add(data: DataMap) {
    ++this._current;
    this._history.length = this._current + 1;
    this._history[this._current] = data;
    this.checkUndoRedo();
  }

  _trackChangeCallback = debounce(() => {
    this._tracking = false;
    if (this.job._history === this) {
      let data = this.job.save();
      if (!deepEqual(data, this._history[this._history.length - 1])) {
        this.add(data);
      }
    }
  }, 1000);

  _tracking = false;
  trackChange() {
    let result = this._tracking;
    this._tracking = true;
    this._trackChangeCallback();
    return result;
  }
  cancelTrack() {
    this._tracking = false;
    this._trackChangeCallback.cancel();
  }
  destroy() {
    this.cancelTrack();
  }
}
