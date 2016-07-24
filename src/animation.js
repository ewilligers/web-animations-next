// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//     You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//     See the License for the specific language governing permissions and
// limitations under the License.

(function(shared, scope, testing) {

  shared.sequenceNumber = 0;

  var AnimationEvent = function(target, currentTime, timelineTime) {
    this.target = target;
    this.currentTime = currentTime;
    this.timelineTime = timelineTime;

    this.type = 'finish';
    this.bubbles = false;
    this.cancelable = false;
    this.currentTarget = target;
    this.defaultPrevented = false;
    this.eventPhase = Event.AT_TARGET;
    this.timeStamp = Date.now();
  };

  var pendingPromise = function(animation) {
    this._animation = animation;
    this._isResolved = false;
    this._promise = new Promise(function(resolve, reject) {
      wrapper._resolve = resolve;
      wrapper._reject = reject;
    });
  }

  pendingPromise.prototype = {
    resolve : function() {
      WEB_ANIMATIONS_TESTING && console.assert(!this._isResolved);
      this._isResolved = true;
      this._resolve(this._animation);
    },
    reject : function(error) {
      WEB_ANIMATIONS_TESTING && console.assert(!this._isResolved);
      this._isResolved = true;
      this._reject(error);
    }
  }

  var resolvedPromise = function(animation) {
    this._animation = animation;
    this._isResolved = true;
    this._promise = Promise.resolve(animation));
  }

  scope.Animation = function(effect, timeline) {
    // https://w3c.github.io/web-animations/#dom-animation-animation
    // Step 1

    // https://w3c.github.io/web-animations/#animations
    this._effect = null;
    this._timeline = null;
    this._startTime = null;
    this._holdTime = null;
    this._sequenceNumber = shared.sequenceNumber++;

    // 3.5.9 https://w3c.github.io/web-animations/#current-ready-promise
    this._currentReadyPromise = resolvedPromise(this);

    // 3.5.10 https://w3c.github.io/web-animations/#pending-play-task
    this._pendingPlayTask = null;

    // 3.5.11 https://w3c.github.io/web-animations/#pending-pause-task
    this._pendingPauseTask = null;

    // 3.5.13 https://w3c.github.io/web-animations/#the-current-finished-promise
    this._currentFinishedPromise = pendingPromise(this);

    // 3.5.14 https://w3c.github.io/web-animations/#previous-current-time
    this._previousCurrentTime = null;

    // 3.5.17 https://w3c.github.io/web-animations/#animation-playback-rate
    this._playbackRate = 1;

    // https://w3c.github.io/web-animations/#finish-notification-steps
    this._finishNotificationSteps = null;

    // https://w3c.github.io/web-animations/#the-animation-interface

    this.id = '';
    if (effect && effect._id) {
      this.id = effect._id;
    }

    /*
             attribute EventHandler             onfinish;
             attribute EventHandler             oncancel;
    */

    // Step 2
    if (timeline) {
      this.timeline = timeline;
    } else {
      this.timeline = scope.timeline;
    }

    // Step 3
    if (effect) {
      this.effect = effect;
    }
  };

  scope.Animation.prototype = {
    get timeline() {
      return this._timeline;
    },
    set timeline(newTimeline) {
      // https://w3c.github.io/web-animations/#setting-the-timeline

      // Step 1, 2
      if (newTimeline === this._timeline) {
        return;
      }

      // Step 3
      this._timeline = newTimeline;

      // Step 4
      if (this._startTime !== null) {
        this._holdTime = null;
      }

      // Step 5
      this._updateFinishedState(false, false);
    },
    get effect() {
      return this._effect;
    },
    set effect(newEffect) {
      // https://w3c.github.io/web-animations/#setting-the-target-effect

      // Step 1, 2
      if (newEffect === this._effect) {
        return;
      }

      // Step 3
      if (newEffect === null && this._effect !== null) {
        this._resetPendingTasks();
      }

      // Step 4
      if (this._pendingPauseTask !== null) {
        // TBD: reschedule this._pendingPauseTask to run as soon as animation is ready
        // [task will receive a current time]
      }

      // Step 5
      if (this._pendingPlayTask !== null) {
        // TBD: reschedule this._pendingPlayTask to run as soon as animation is ready to play new effect
      }

      // Step 6
      if (newEffect !== null &&
          newEffect._animation !== null &&
          newEffect._animation !== this) {
        newEffect._animation.effect = null;
      }

      // Step 7
      this._effect = newEffect;
      newEffect._animation = this;

      // Step 8
      this._updateFinishedState(false, false);
    },
    _resetPendingTasks: function() {
      // https://w3c.github.io/web-animations/#reset-an-animations-pending-tasks

      // Step 1
      if (this._pendingPlayTask !== null) {
        this._pendingPlayTask = null;
      }

      // Step 2
      if (this._pendingPauseTask !== null) {
        this._pendingPauseTask = null;
      }

      // Step 3
      // "If cancelable promises materialize, we should probably cancel here instead of rejecting."
      this._currentReadyPromise.reject(new DOMException('', 'AbortError'));

      // Step 4
      this._currentReadyPromise = resolvedPromise(this);
    },
    get currentTime() {
      // https://w3c.github.io/web-animations/#the-current-time-of-an-animation
      if (this._holdTime !== null) {
        return this._holdTime;
      }
      if (this._timeline === null ||
          this._timeline._isInactive() ||
          this._startTime === null) {
        return null;
      }
      return (timeline.currentTime - this._startTime) * this._playbackRate;
    },
    _silentlySetCurrentTime: function(seekTime) {
      // https://w3c.github.io/web-animations/#silently-set-the-current-time

      // Step 1
      if (seekTime === null) {
        if (this._currentTime !== null) {
          throw new TypeError();
        }
        return;
      }

      // Step 2
      if (this._holdTime !== null ||
          this._startTime === null ||
          this._timeline === null ||
          this._timeline._isInactive() ||
          this._playbackRate === 0) {
        this._holdTime = seekTime;
      } else {
        this._startTime = this._timeline.currentTime - (seekTime / this._playbackRate);
      }

      // Step 3
      if (this._timeline === null || this._timeline._isInactive()) {
        this._startTime = null;
      }
      this._assertNoActiveTimelineInvariant();

      // Step 4
      this._previousCurrentTime = null;
    },
    set currentTime(seekTime) {
      // https://w3c.github.io/web-animations/#setting-the-current-time-of-an-animation

      // Step 1
      _silentlySetCurrentTime(seekTime);

      // Step 2
      if (this._pendingPauseTask) {
        this._holdTime = seekTime;
        this._startTime = null;
        this._pendingPauseTask = null;
        this._currentReadyPromise().resolve(this);
      }

      // Step 3
      this._updateFinishedState(true, false);
    },
    _assertNoActiveTimelineInvariant: function() {
      if (WEB_ANIMATIONS_TESTING && (this._timeline === null || this._timeline._isInactive())) {
        console.assert(this._startTime === null || this._currentTime === null);
      }
    },
    get startTime() {
      return this._startTime;
    },
    set startTime(newStartTime) {
      // https://w3c.github.io/web-animations/#setting-the-start-time-of-an-animation

      // Step 1
      var timelineTime = null;
      if (this._timeline !== null && !this._timeline._isInactive()) {
        timelineTime = this._timeline.currentTime;
      }

      // Step 2
      if (timelineTime == null && newStartTime !== null) {
        this.holdTime = null;
      }
      this._assertNoActiveTimelineInvariant();

      // Step 3
      var previousCurrentTime = this._currentTime;

      // Step 4
      this._startTime = newStartTime;

      // Step 5
      if (newStartTime !== null) {
        if (this._playbackRate !== 0) {
          this._holdTime = null;
        }
      } else {
        this._holdTime = previousCurrentTime;
      }

      // Step 6
      if (this._pendingPlayTask || this._pendingPauseTask) {
        this._pendingPlayTask = null;
        this._pendingPauseTask = null;
        this._currentReadyPromise.resolve(this);
      }

      // Step 7
      this._updateFinishedState(true, false);
    },
    play: function() {
      // https://w3c.github.io/web-animations/#dom-animation-play
      this._playAnimation(true);
    },
    _playAnimation: function(autoRewind) {
      // https://w3c.github.io/web-animations/#play-an-animation

      // Step 1
      var abortedPause = this._pendingPauseTask !== null;

      // Step 2
      var hasPendingReadyPromise = false;

      // Step 3
      if (this._playbackRate > 0 && autoRewind) {
        if (this._currentTime === null ||
            this._currentTime < 0 ||
            this._currentTime >= this._targetEffectEnd()) {
          this._holdTime = 0;
        }
      } else if (this._playbackRate < 0 && autoRewind) {
        if (this._currentTime === null ||
            this._currentTime <= 0 ||
            this._currentTime > this._targetEffectEnd()) {
          if (this._effect.end === Infinity) {
            throw new InvalidStateError();
          }
          this._holdTime = this._targetEffectEnd();
        }
      } else if (this._playbackRate === 0 && this._currentTime === null) {
        this.holdTime = 0;
      }

      // Step 4
      if (this._pendingPlayTask || this._pendingPauseTask) {
        this._pendingPlayTask = null;
        this._pendingPauseTask = null;
        hasPendingReadyPromise = true;
      }

      // Step 5
      if (this._holdTime === null && !abortedPromise) {
        return;
      }

      // Step 6
      if (this._holdTime !== null) {
        this._startTime = null;
      }

      // Step 7
      if (!hasPendingReadyPromise) {
        this._currentReadyPromise = pendingPromise(this);
      }

      // Step 8
      var self = this;
      var pendingPlayTask = function() {
        // Step 1
        var readyTime = self._timeline.currentTime;

        // Step 2
        if (self._startTime === null) {
          var newStartTime = (** ready time **);
          if (self._playbackRate !== 0) {
            newStartTime -= self._holdTime / self._playbackRate;
            self._holdTime = null;
            self._startTime = newStartTime;
          }
        }

        // Step 3
        self._currentReadyPromise.resolve(self);

        // Step 4
        self._updateFinishedState(false, false);
      };
      setTimeout(pendingPlayTask, 0);

      // Step 9
      this._updateFinishedState(false, false);
    },
    pause: function() {
      // https://w3c.github.io/web-animations/#pause-an-animation

      // Step 1
      if (this._pendingPauseTask !== null) {
        return;
      }

      // Step 2
      if (this.playState === 'paused') {
        return;
      }

      // Step 3
      if (this.currentTime === null) {
        if (this._playbackRate >= 0) {
          this._holdTime = 0;
        } else {
          if (this._targetEffectEnd() === Infinity) {
            throw new InvalidStateError();
          } else {
            this._holdTime = this._targetEffectEnd();
          }
        }
      }

      // Step 4
      var hasPendingReadyPromise = false;

      // Step 5
      if (this._pendingPlayTask) {
        this._pendingPlayTask = null;
        hasPendingReadyPromise = true;
      }

      // Step 6
      if (hasPendingReadyPromise === false) {
        this._currentReadyPromise = pendingPromise(this);
      }

      // Step 7
      var self = this;
      this._pendingPauseTask = function() {
        // While this task is running, the animation does not have a pending pause task.
        self._pendingPauseTask = null;

        // Step 1
        // time value of the timeline associated with animation at the moment when the user agent
        // completed processing necessary to suspend playback of animation’s target effect.
        var readyTime = self._timeline.currentTime;

        // Step 2
        if (self._startTime !== null && self._holdTime === null) {
          self._holdTime = readyTime - (self._startTime / self._playbackRate);
        }

        // Step 3
        self._startTime = null;

        // Step 4
        self._currentReadyPromise.resolve(self);

        // Step 5
        self._updateFinishedState(false, false);
      };
      requestAnimationFrame(this._pendingPauseTask);

      // Step 8
      this._updateFinishedState(false, false);
    },
    _targetEffectEnd: function() {
      // https://w3c.github.io/web-animations/#target-effect-end
      // https://w3c.github.io/web-animations/#end-time
      if (this._effect === null) {
        return 0;
      }

      return this._effect.timing.delay + this._effect.activeDuration + this._effect.timing.endDelay;
    },
    _updateFinishedState: function(didSeek, synchronouslyNotify) {
      // https://w3c.github.io/web-animations/#update-an-animations-finished-state

      // Step 1
      if (this._startTime !== null &&
          this._pendingPlayTask === null &&
          this._pendingPauseTask === null) {
        if (this._playbackRate > 0 &&
            this.currentTime !=== null &&
            this.currentTime >= this._targetEffectEnd) {
          if (didSeek) {
            this._holdTime = this.currentTime;
          } else {
            if (this._previousCurrentTime === null) {
              this._holdTime = this._targetEffectEnd;
            } else {
              this._holdTime = max(this._previousCurrentTime, this._targetEffectEnd);
            }
          }
        } else if (this._playbackRate < 0 &&
                   this.currentTime !== null &&
                   this.currentTime <= 0) {
          if (didSeek) {
            this._holdTime = this.currentTime;
          } else {
            this._holdTime = 0;
          }
        } else if (this.currentTime !== null &&
                   this._playbackRate !== 0 &&
                   this._timeline !== null &&
                   this._timeline._isInactive()) {
          if (didSeek && this._holdTime !== null) {
            this._startTime = this._timeline.currentTime - (this._holdTime / this._playbackRate);
          }
          this._holdTime = null;
        }

        // Step 2
        this._previousCurrentTime = this.currentTime;

        // Step 3
        var currentFinishedState = false;
        if (this.playState === 'finished') {
          currentFinishedState = true;
        }

        // Step 4
        if (currentFinishedState &&
            !this._currentFinishedPromise.IsResolved()) {
          var self = this;
          var finishNotificationSteps = function() {
            if (this._finishNotificationSteps === null) {
              // finish notification steps have been cancelled.
              return;
            }

            // Step 1
            if (self.playState !== 'finished') {
              return;
            }

            // Step 2
            self._currentFinishedPromise.resolve(self);

            // Step 3
            // TBD: Queue a task to fire a finish event at animation.
            // The task source for this task is the DOM manipulation task source.
            setTimeout(function() {

            }, 0);
          };

          if (synchronouslyNotify) {
            this._finishNotificationSteps = null;
            finishNotificationSteps();
          } else {
            if (this._finishNotificationSteps === null) {
              this._finishNotificationSteps = finishNotificationSteps;
            }
            setTimeout(finishNotificationSteps, 0);
          }
        }

        // Step 5
        if (!currentFinishedState &&
            this._currentFinishedPromise._isResolved {
          this._currentFinishedPromise = pendingPromise(this);
        }
      }
    },
    finish: function() {
      // https://w3c.github.io/web-animations/#finishing-an-animation-section
      // https://w3c.github.io/web-animations/#finish-an-animation

      // Step 1
      if (this._playbackRate === 0 ||
          (this._playbackRate > 0 && this._targetEffectEnd === Infinity)) {
        throw new InvalidStateError();
      }

      // Step 2
      var limit = 0;
      if (this._playbackRate > 0) {
        limit = this._targetEffectEnd;
      }

      // Step 3
      this._silentlySetCurrentTime(limit);

      // Step 4
      if (this._startTime === null &&
          this._timeline !== null &&
          !this._timeline._isInactive()) {
        this._startTime = this._timeline.currentTime - (limit / this._playbackRate);
      }

      // Step 5
      if (this._pendingPauseTask !== null && this._startTime !== null) {
        this._holdTime = null;
        this._pendingPauseTask = null;
        this._currentReadyPromise.resolve(this);
      }

      // Step 6
      if (this._pendingPlayTask && this._startTime !== null) {
        this._pendingPlayTask = null;
        this._currentReadyPromise.resolve(this);
      }

      // Step 7
      this._updateFinishedState(true, true);
    },
    cancel: function() {
      // https://w3c.github.io/web-animations/#canceling-an-animation-section

      // Step 1
      if (this.playState !== 'idle') {
        this._resetPendingTasks();
        this._currentFinishedPromise.reject(new DOMException('', 'AbortError'));
        this._currentFinishedPromise = pendingPromise(this);
        if (this.playState !== 'idle') {
          // TBD: queue a task to fire a cancel event at animation. The task source for this task is the DOM manipulation task source.

          // The event current time for the dispatched cancel event is unresolved
          // the event timeline time is the current time value of the timeline associated with animation at the moment the task is queued.
        }
      }

      // Step 2
      this._holdTime = null;

      // Step 3
      this._startTime = null;
    },
    get playbackRate() {
      return this._playbackRate;
    },
    set playbackRate(newPlaybackRate) {
      // https://w3c.github.io/web-animations/#set-the-animation-playback-rate

      // Step 1
      var previousTime = this._currentTime;

      // Step 2
      this._playbackRate = newPlaybackRate;

      // Step 3
      if (previousTime !== null) {
        this.currentTime = previousTime;
      }
    },
    _silentlySetPlaybackRate : function(newPlaybackRate) {
      // https://w3c.github.io/web-animations/#silently-set-the-animation-playback-rate

      // Step 1
      var previousTime = this._currentTime;

      // Step 2
      this._playbackRate = newPlaybackRate;

      // Step 3
      if (previousTime !== null) {
        this._silentlySetCurrentTime(previousTime);
      }
    },
    reverse: function() {
      // https://w3c.github.io/web-animations/#reversing-an-animation-section

      // Step 1
      if (this._timeline === null || this._timeline._isInactive()) {
        throw new InvalidStateError();
      }

      // Step 2
      this._silentlySetPlaybackRate(-this._playbackRate);

      // Step 3
      this._playAnimation(true);
    },
    get playState() {
      // 3.5.19 https://w3c.github.io/web-animations/#play-state

      if (this._pendingPlayTask !== null || this._pendingPauseTask) {
        WEB_ANIMATIONS_TESTING && console.assert(!this._currentFinishedPromise._isResolved);
        return 'pending';
      }
      if (this._currentTime === null) {
        WEB_ANIMATIONS_TESTING && console.assert(!this._currentFinishedPromise._isResolved);
        return 'idle';
      }
      if (this._startTime === null) {
        WEB_ANIMATIONS_TESTING && console.assert(!this._currentFinishedPromise._isResolved);
        return 'paused';
      }
      if ((this._playbackRate > 0 && this.currentTime >= this._targetEffectEnd()) ||
          (this._playbackRate < 0 && this.currentTime <= 0)) {
        WEB_ANIMATIONS_TESTING && console.assert(this._currentFinishedPromise._isResolved);
        return 'finished';
      }
      WEB_ANIMATIONS_TESTING && console.assert(!this._currentFinishedPromise._isResolved);
      return 'running';
    },
    get ready() {
      // https://w3c.github.io/web-animations/#dom-animation-ready
      return this._currentReadyPromise._promise;
    },
    get finished() {
      // https://w3c.github.io/web-animations/#dom-animation-finished
      return this._currentFinishedPromise._promise;
    }
  };

  if (WEB_ANIMATIONS_TESTING) {
    testing.webAnimations1Animation = scope.Animation;
  }

})(webAnimationsShared, webAnimations1, webAnimationsTesting);
