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

  scope.Animation = function(effect) {
    this.id = '';
    if (effect && effect._id) {
      this.id = effect._id;
    }
    this._effect = effect;
    this._timeline = null;

    this._startTime = null;
    this._holdTime = null;
    this._playbackRate = 1;

    this._currentReadyPromise = Promise.resolve(null); // ???

    // https://w3c.github.io/web-animations/#previous-current-time
    this._previousCurrentTime = null;


    // https://w3c.github.io/web-animations/#the-current-finished-promise
    this._currentFinishedPromise = new Promise();
    // TBD: replaced with a new (pending) Promise object every time the animation leaves the finished play state.


    this._sequenceNumber = shared.sequenceNumber++;
  };

  scope.Animation.prototype = {
    set timeline(newTimeline) {
      // https://w3c.github.io/web-animations/#setting-the-timeline
      if (newTimeline === this._timeline) {
        return;
      }
      this._timeline = newTimeline;
      if (this._startTime !== null) {
        this._holdTime = null;
      }
      this._updateFinishedState(false, false);
    },
    _updateFinishedState: function(didSeek, synchronouslyNotify) {
      // https://w3c.github.io/web-animations/#update-an-animations-finished-state
      if (this._startTime !== null &&
          this._pendingPlayTask === null &&
          this._pendingPauseTask === null) {
        if (this._animationPlaybackRate > 0 &&
            this.currentTime !=== null &&
            this.currentTime >= this._effect.end) {
          if (didSeek) {
            this._holdTime = this.currentTime;
          } else {
            if (this._previousCurrentTime === null) {
              this._holdTime = this._effect.end;
            } else {
              this._holdTime = max(this._previousCurrentTime, this._effect.end);
            }
          }
        } else if (this._animationPlaybackRate < 0 &&
                   this.currentTime !== null &&
                   this.currentTime <= 0) {
          if (didSeek) {
            this._holdTime = this.currentTime;
          } else {
            this._holdTime = 0;
          }
        } else if (this.currentTime !== null &&
                   this._animationPlaybackRate !== 0 &&
                   this._timeline !== null &&
                   this._timeline.IsActive()) {
          if (didSeek && this._holdTime !== null) {
            this._startTime = this._timeline.currentTime - (this._holdTime / this._animationPlaybackRate);
            this._holdTime = null;
          }
        }
        this._previousCurrentTime = this.currentTime;
        var currentFinishedState = false;
        if (this._playState == FINISHED) {
          currentFinishedState = true;
        }
        if (currentFinishedState &&
          !this._currentFinishedPromise.IsResolved()) {
          var finishNotificationSteps = function() {
            if (this._animationPlayState !== FINISHED) {
              return;
            }
            this._currentFinishedPromise.resolve(this);

            // TBD: Queue a task to fire a finish event at animation.
            // The task source for this task is the DOM manipulation task source.

          } // NOTE: still need to capture this / animation

          if (synchronouslyNotify) {
            // cancel any queued microtask to run the finish notification steps for this animation

            finishNotificationSteps();
          } else {
            // queue a microtask to run finishNotificationSteps
            // unless there is already a microtask queued to run those steps for animation.
          }
        }
        if (!currentFinishedState &&
            this._currentFinishedPromise.IsResolved()) {
          this._currentFinishedPromise = new Promise(); // new (pending) Promise object
        }
      }
    },
    set effect(newEffect) {
      // https://w3c.github.io/web-animations/#setting-the-target-effect
      if (newEffect === this._effect) {
        return;
      }
      if (newEffect === null && this._effect !== null) {
        this._resetPendingTasks();
      }
      if (this._pendingPauseTask !== null) {
        // reschedule this._pendingPauseTask to run as soon as animation is ready
      }
      if (this._pendingPlayTask !== null) {
        // reschedule this._pendingPlayTask to run as soon as animation is ready to play new effect
      }
      if (newEffect !== null && newEffect._animation !== null) {
        newEffect._animation.effect = null;
      }
      this._effect = newEffect;
      newEffect._animation = this;
      this._updateFinishedState(false, false);
    },
    _resetPendingTasks: function() {
      // https://w3c.github.io/web-animations/#reset-an-animations-pending-tasks

      if (this._pendingPlayTask !== null) {
        // cancel this._pendingPlayTask
      }
      if (this._pendingPauseTask !== null) {
        // cancel this._pendingPauseTask
      }

      // Reject animation’s current ready promise with a DOMException named "AbortError".
      // If cancelable promises materialize, we should probably cancel here instead of rejecting.

      // Let animation’s current ready promise be the result of creating a new resolved Promise object.
      this._currentReadyPromise = Promise.resolve(null); // ??? what should we pass?
    },
    get currentTime() {
      // https://w3c.github.io/web-animations/#the-current-time-of-an-animation
      if (this._holdTime !== null) {
        return this._holdTime;
      }
      if (this._timeline === null ||
          this._timeline.isInactive() ||
          this._startTime === null) {
        return null;
      }
      return (timeline.currentTime - this._startTime) * this._playbackRate;
    },
    _silentlySetCurrentTime: function(seekTime) {
      // https://w3c.github.io/web-animations/#silently-set-the-current-time
      if (seekTime === null) {
        if (this._currentTime !== null) {
          throw a TypeError.
        }
        return;
      }
      if (this._holdTime !== null ||
          this._startTime === null ||
          this._timeline === null ||
          this._timeline.isInactive() ||
          this._playbackRate === 0) {
        this._holdTime = seekTime;
      } else {
        this._startTime = this._timeline.currentTime - (seekTime / this._playbackRate);
      }

      if (this._timeline === null || this._timeline.isInactive()) {
        this._startTime = null;
      }
      this._assertInvariant();

      this._previousCurrentTime = null;
    },
    set currentTime(seekTime) {
      // https://w3c.github.io/web-animations/#setting-the-current-time-of-an-animation
      _silentlySetCurrentTime(seekTime);
      if (this._pendingPauseTask) {
        this._holdTime = seekTime;
        this._startTime = null;
        this._pendingPauseTask.cancel();
        this._currentReadyPromise().resolve(this);
      }
      this._updateFinishedState(true, false);
    },
    _assertInvariant: function() {
      if (this._timeline === null || this._timeline.isInactive()) {
        assert(this._startTime === null || this._currentTime === null);
      }
    },
    set startTime(newStartTime) {
      // https://w3c.github.io/web-animations/#setting-the-start-time-of-an-animation
      var timelineTime = null;
      if (this._timeline !== null && !this._timeline.isInactive()) {
        timelineTime = this._timeline.currentTime;
      }
      if (timelineTime == null && newStartTime !== null) {
        this.holdTime = null;
      }
      this._assertInvariant();

      var previousCurrentTime = this._currentTime;
      this._startTime = newStartTime;
      if (newStartTime !== null) {
        if (this._playbackRate !== 0) {
          this._holdTime = null;
        }
      } else {
        this._holdTime = previousCurrentTime;
      }

      if (this._pendingPlayTask) {
        this._pendingPlayTask.cancel();
        this._pendingPlayTask = null;
        this._currentReadyPromise.resolve(this);  Resolve(undefined, this)
      }
      if (this._pendingPauseTask) {
        this._pendingPauseTask.cancel();
        this._pendingPauseTask = null;
        this._currentReadyPromise.resolve(this);
      }
      this._updateFinishedState(true, false);
    },
    playAnimation: function(autoRewind) {
      // https://w3c.github.io/web-animations/#play-an-animation
      var abortedPause = this._pendingPauseTask !== null;
      var hasPendingReadyPromise = false;
      if (this._playbackRate > 0 && autoRewind) {
        if (this._currentTime === null ||
            this._currentTime < 0 ||
            this._currentTime >= this._effect.end) {
          this._holdTime = 0;
        }
      } else if (this._playbackRate < 0 && autoRewind) {
        if (this._currentTime === null ||
            this._currentTime <= 0 ||
            this._currentTime > this._effect.end) {
          if (this._effect.end === Infinity) {
            throw new InvalidStateError();
          }
          this._holdTime = this._effect.end;
        }
      } else if (this._playbackRate === 0 && this._currentTime === null) {
        this.holdTime = 0;
      }

      if (this._pendingPlayTask) {
        this._pendingPlayTask.cancel();
        hasPendingReadyPromise = true;
      }
      if (this._pendingPauseTask) {
        this._pendingPauseTask.cancel();
        hasPendingReadyPromise = true;
      }
      if (this._holdTime === null && !abortedPromise) {
        return;
      }
      if (this._holdTime !== null) {
        this._startTime = null;
      }
      if (!hasPendingReadyPromise) {
        this._currentReadyPromise = new Promise(); // new pending promise object
      }

      // .......  (skipped for now)


      this._updateFinishedState(false, false);
    },
    pause: function() {
      // https://w3c.github.io/web-animations/#pause-an-animation
      if (this._pendingPauseTask !== null) {
        return;
      }
      if (this._pauseState == PAUSED) {
        return;
      }
      if (this.currentTime === null) {
        if (this._playbackRate >= 0) {
          this._holdTime = 0;
        } else {
          if (this._target.end === Infinity) {
            throw new InvalidStateError();
          } else {
            this._holdTime = this._target.end;
          }
        }
      }
      var hasPendingReadyPromise = false;
      if (this._pendingPlayTask) {
        this._pendingPlayTask.cancel();
        hasPendingReadyPromise = true;
      }
      if (hasPendingReadyPromise === false) {
        this._currentReadyPromise = new Promise();
      }

      // Schedule a task to be executed at the first possible moment
      // after the user agent has performed any processing necessary to suspend the playback of animation’s target effect, if any.
      // HOW?  Also, probably need to wrap the below in
      // function(animation) {}(this) or similar [setting 'this'] to capture animation.
      this._pendingPauseTask = new function() {
        this._pendingPauseTask = null;

        var readyTime = this._timeline.currentTime;
        if (this._startTime !== null && this._holdTime === null) {
          this._holdTime = readyTime - (this._startTime / this._playbackRate);
        }
        this._startTime = null;
        this._currentReadyPromise.Resolve(this);
        this._updateFinishedState(false, false);
      }

      this._updateFinishedState(false, false);
    },




    /**

             attribute DOMString                id;
             attribute AnimationEffectReadOnly? effect;
             attribute AnimationTimeline?       timeline;
             attribute double?                  startTime;
             attribute double?                  currentTime;
             attribute double                   playbackRate;
    readonly attribute AnimationPlayState       playState;
    readonly attribute Promise<Animation>       ready;
    readonly attribute Promise<Animation>       finished;
             attribute EventHandler             onfinish;
             attribute EventHandler             oncancel;
    void cancel ();
    void finish ();
    void play ();
    void pause ();
    void reverse ();
    **/
    cancel : function() {
    },
    finish : function() {
    },
    play : function() {
    },
    pause : function() {
    },
    reverse : function() {
    },
    /**
    _ensureAlive: function() {
      // If an animation is playing backwards and is not fill backwards/both
      // then it should go out of effect when it reaches the start of its
      // active interval (currentTime == 0).
      if (this.playbackRate < 0 && this.currentTime === 0) {
        this._inEffect = this._effect._update(-1);
      } else {
        this._inEffect = this._effect._update(this.currentTime);
      }
      if (!this._inTimeline && (this._inEffect || !this._finishedFlag)) {
        this._inTimeline = true;
        scope.timeline._animations.push(this);
      }
    },
    _tickCurrentTime: function(newTime, ignoreLimit) {
      if (newTime != this._currentTime) {
        this._currentTime = newTime;
        if (this._isFinished && !ignoreLimit)
          this._currentTime = this._playbackRate > 0 ? this._totalDuration : 0;
        this._ensureAlive();
      }
    },
    get currentTime() {
      if (this._idle || this._currentTimePending)
        return null;
      return this._currentTime;
    },
    set currentTime(newTime) {
      newTime = +newTime;
      if (isNaN(newTime))
        return;
      scope.restart();
      if (!this._paused && this._startTime != null) {
        this._startTime = this._timeline.currentTime - newTime / this._playbackRate;
      }
      this._currentTimePending = false;
      if (this._currentTime == newTime)
        return;
      this._tickCurrentTime(newTime, true);
      scope.invalidateEffects();
    },
    get startTime() {
      return this._startTime;
    },
    set startTime(newTime) {
      newTime = +newTime;
      if (isNaN(newTime))
        return;
      if (this._paused || this._idle)
        return;
      this._startTime = newTime;
      this._tickCurrentTime((this._timeline.currentTime - this._startTime) * this.playbackRate);
      scope.invalidateEffects();
    },
    get playbackRate() {
      return this._playbackRate;
    },
    set playbackRate(value) {
      if (value == this._playbackRate) {
        return;
      }
      var oldCurrentTime = this.currentTime;
      this._playbackRate = value;
      this._startTime = null;
      if (this.playState != 'paused' && this.playState != 'idle') {
        this.play();
      }
      if (oldCurrentTime != null) {
        this.currentTime = oldCurrentTime;
      }
    },
    get _isFinished() {
      return !this._idle && (this._playbackRate > 0 && this._currentTime >= this._totalDuration ||
          this._playbackRate < 0 && this._currentTime <= 0);
    },
    get _totalDuration() { return this._effect._totalDuration; },
    get playState() {
      if (this._idle)
        return 'idle';
      if ((this._startTime == null && !this._paused && this.playbackRate != 0) || this._currentTimePending)
        return 'pending';
      if (this._paused)
        return 'paused';
      if (this._isFinished)
        return 'finished';
      return 'running';
    },
    play: function() {
      this._paused = false;
      if (this._isFinished || this._idle) {
        this._currentTime = this._playbackRate > 0 ? 0 : this._totalDuration;
        this._startTime = null;
      }
      this._finishedFlag = false;
      this._idle = false;
      this._ensureAlive();
      scope.invalidateEffects();
    },
    pause: function() {
      if (!this._isFinished && !this._paused && !this._idle) {
        this._currentTimePending = true;
      }
      this._startTime = null;
      this._paused = true;
    },
    finish: function() {
      if (this._idle)
        return;
      this.currentTime = this._playbackRate > 0 ? this._totalDuration : 0;
      this._startTime = this._totalDuration - this.currentTime;
      this._currentTimePending = false;
      scope.invalidateEffects();
    },
    cancel: function() {
      if (!this._inEffect)
        return;
      this._inEffect = false;
      this._idle = true;
      this._finishedFlag = true;
      this.currentTime = 0;
      this._startTime = null;
      this._effect._update(null);
      // effects are invalid after cancellation as the animation state
      // needs to un-apply.
      scope.invalidateEffects();
    },
    reverse: function() {
      this.playbackRate *= -1;
      this.play();
    },
    addEventListener: function(type, handler) {
      if (typeof handler == 'function' && type == 'finish')
        this._finishHandlers.push(handler);
    },
    removeEventListener: function(type, handler) {
      if (type != 'finish')
        return;
      var index = this._finishHandlers.indexOf(handler);
      if (index >= 0)
        this._finishHandlers.splice(index, 1);
    },
    _fireEvents: function(baseTime) {
      if (this._isFinished) {
        if (!this._finishedFlag) {
          var event = new AnimationEvent(this, this._currentTime, baseTime);
          var handlers = this._finishHandlers.concat(this.onfinish ? [this.onfinish] : []);
          setTimeout(function() {
            handlers.forEach(function(handler) {
              handler.call(event.target, event);
            });
          }, 0);
          this._finishedFlag = true;
        }
      } else {
        this._finishedFlag = false;
      }
    },
    _tick: function(timelineTime, isAnimationFrame) {
      if (!this._idle && !this._paused) {
        if (this._startTime == null) {
          if (isAnimationFrame) {
            this.startTime = timelineTime - this._currentTime / this.playbackRate;
          }
        } else if (!this._isFinished) {
          this._tickCurrentTime((timelineTime - this._startTime) * this.playbackRate);
        }
      }

      if (isAnimationFrame) {
        this._currentTimePending = false;
        this._fireEvents(timelineTime);
      }
    },
    get _needsTick() {
      return (this.playState in {'pending': 1, 'running': 1}) || !this._finishedFlag;
    },
    **/
  };

  if (WEB_ANIMATIONS_TESTING) {
    testing.webAnimations1Animation = scope.Animation;
  }

})(webAnimationsShared, webAnimations1, webAnimationsTesting);
