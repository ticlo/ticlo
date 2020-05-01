import debounce from 'lodash/debounce';
import {DataMap} from '../util/DataTypes';
import type {Flow} from './Flow';
import {deepEqual} from '../util/Compare';

// when an change is applied, need to restore history from the previous saved data
const _historyCache = new Map<any, DataMap[]>();

export class FlowHistory {
  static _debounceInterval = 1000;

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

  constructor(public job: Flow, savedData?: DataMap) {
    if (savedData) {
      this._savedData = savedData;
      let cachedHistory = _historyCache.get(savedData);
      if (cachedHistory && cachedHistory[cachedHistory.length - 1] === savedData) {
        // use cached history
        this._history = [..._historyCache.get(savedData)];
        this._current = this._history.length - 1;
        this.setUndo(true);
      } else {
        this._history = [savedData];
      }
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

  save() {
    let data = this.job.save();
    if (this.checkAndAdd(data)) {
      this._savedData = data;
    } else {
      data = this._history[this._current];
      this._savedData = data;
    }
    this.checkUndoRedo(data);
    return data;
  }

  undo() {
    if (this._tracking) {
      this.checkAndAdd(this.job.save());
    }
    if (this._current > 0) {
      --this._current;
      this.applyData(this._history[this._current]);
    }
  }

  redo() {
    if (this._tracking) {
      // a new change is going to be added, there is nothing to redo
      return;
    }
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

  // return true when data has change
  checkAndAdd(data: DataMap) {
    if (this._tracking) {
      this.cancelTrack();
    }
    if (!deepEqual(data, this._history[this._current])) {
      this.add(data);
      return true;
    }
    return false;
  }
  _trackChangeCallback = debounce(() => {
    this._tracking = false;
    this.checkAndAdd(this.job.save());
  }, FlowHistory._debounceInterval);

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
    if (this._history.length > 1 && this._history[this._history.length - 1] === this._savedData) {
      _historyCache.set(this._savedData, this._history);
      setTimeout(() => {
        _historyCache.delete(this._savedData);
      }, 1000);
    }
  }
}
