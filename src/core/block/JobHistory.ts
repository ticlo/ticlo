import debounce from 'lodash/debounce';
import {DataMap} from '../util/DataTypes';
import {/*type*/ Job} from './Job';
import {deepEqual} from '../util/Compare';

export class JobHistory {
  _savedData: DataMap;
  _history: DataMap[];
  _current = 0;

  _hasUndo = false;
  _hasRedo = false;
  _hasChange = false;

  setUndo(hasUndo: boolean) {
    if (hasUndo !== this._hasUndo) {
      this._hasUndo = hasUndo;
      this.job.updateValue('@has-undo', hasUndo || undefined); // true or undefined
    }
  }
  setRedo(hasRedo: boolean) {
    if (hasRedo !== this._hasRedo) {
      this._hasRedo = hasRedo;
      this.job.updateValue('@has-redo', hasRedo || undefined); // true or undefined
    }
  }

  setHasChange(hasChange: boolean) {
    if (hasChange !== this._hasChange) {
      this._hasChange = hasChange;
      this.job.updateValue('@has-change', hasChange || undefined); // true or undefined
    }
  }

  constructor(public job: Job, savedData?: DataMap) {
    if (savedData) {
      this._savedData = savedData;
      this._history = [savedData];
    } else {
      let data = job.save();
      if (!job.getValue('@has-change')) {
        this._savedData = data;
      }
      this._history = [data];
    }
  }

  checkUndoRedo(data: DataMap) {
    this.setUndo(this._current > 0 || this._tracking);

    this.setRedo(this._current < this._history.length - 1);

    if (this._savedData) {
      this.setHasChange(data !== this._savedData);
    }
  }

  applyData(data: DataMap) {
    this.job.liveUpdate(data);
    this.checkUndoRedo(data);
  }

  applyChange() {
    this.cancelTrack();
    let data = this.job.save();
    if (deepEqual(data, this._history[this._current])) {
      data = this._history[this._current];
      this._savedData = data;
      this.checkUndoRedo(data);
    } else {
      this._savedData = data;
      this.add(data);
    }
    return data;
  }

  undo() {
    if (this._tracking) {
      // if _trackChangeCallback is not called yet, undo to the current saved state
      this.cancelTrack();
      this.applyData(this._history[this._current]);
    } else if (this._current > 0) {
      --this._current;
      this.applyData(this._history[this._current]);
    }
  }

  redo() {
    if (this._current < this._history.length - 1) {
      this.cancelTrack();
      ++this._current;
      this.applyData(this._history[this._current]);
    }
  }

  add(data: DataMap) {
    ++this._current;
    this._history.length = this._current + 1;
    this._history[this._current] = data;
    this.checkUndoRedo(data);
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
    this._tracking = true;
    this.setUndo(true);
    this.setHasChange(true);
    this._trackChangeCallback();
  }

  cancelTrack() {
    this._tracking = false;
    this._trackChangeCallback.cancel();
  }
  destroy() {
    this.cancelTrack();
  }
}
