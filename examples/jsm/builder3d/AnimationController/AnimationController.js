import {
    AnimationMixer,
    LoopOnce,
    LoopRepeat
} from 'three';

class AnimationTransition { //transitions bewtween 2 states Maybe transitions can go in "animation state" step of json
    constructor(animationController, fromState, targetState, params) {
        params = params == null ? {} : params;

        // SHOULD THE NEXT STATE WAIT ON A SPECIFIC TIME TO EXIT?
        this.hasExitTime = params.exitTime == null ? false : true;
        // SPECIFIC TIME TO EXIT: NORMALIZED
        this.exitTime = params.exitTime == null ? 0 : params.exitTime;
        // NORMALIZED PLAY POSITION OF NEXT STATE
        this.offset = params.offset == null ? 0 : params.offset;
        // SHOULD TRANSITION DURATION BE IN SECONDS (FIXED) OR % OF ORIGIN'AS STATE
        this.fixedDuration = params.fixedDuration == null ? true : params.fixedDuration;
        // DURATION IN EITHER % OR TIME
        this.duration = params.duration == null ? 0 : params.duration;

        // DOES TRANSITIONS FROM ORIGIN STATE (FROM) CAN INTERRUPT THIS TRANSITION?
        this.fromBreaks = params.fromBreaks == null ? false : params.fromBreaks;
        // DOES TRANSITIONS FROM TARGET STATE (TO) CAN INTERRUPT THIS TRANSITION?
        this.toBreaks = params.toBreaks == null ? false : params.toBreaks;
        // DOES TRANSITIONS BREAK HAS PRIORITY VALIDATION ON ORIGINAL STATE (FRFOM), OR TARGET STATE (TO)?
        this.fromPriority = params.fromPriority == null ? true : params.fromPriority;
        // ONLY WORKS IN "FROM" BREAKS, IF SET TO TRUE, WILL ONLY CHECK TRANSITIONS THAT ARE AFTER THIS TRANSITION IN THE TRANSITIONS ARRAY OF THAT STATE
        this.orderedBreak = params.orderedBreak == null ? true : params.orderedBreak;

        this.animationController = animationController;

        this.fromState = fromState;
        this.targetState = targetState;

        // ALL CONDITIONS THAT MUST BE MET FOR THIS TRANSITION TO BE SUCCESFFUL, IF NONE IS SET IT WILL CHANGE WITH EXIT TIME
        this.conditions = [];

        // HAS IT ALREADY REACHED EXIT TIME?, IT RESETS EVERY TIME ANIMATION LOOPS
        this.pastExitTime = false;
    }

    validate() {
        // CHECK ONLY ONCE PER LOOP IF IT HAS EXIT TIME
        if (this.hasExitTime === true) {
            if (this.pastExitTime === false) {
                if (this.fromState.time > this.exitTime * this.fromState.duration) {
                    this.pastExitTime = true;
                } else return false
            } else return false
        }

        let moveon = true;
        this.conditions.forEach(fn => {
            moveon = fn();
        });
        return moveon;
    }

    addNewCondition(paramString, cond, value) {
        const newCond = this.createCondition(paramString, cond, value);
        if (newCond != null)
            this.conditions.push(newCond);
    }

    resetLoop() {
        this.pastExitTime = false;
    }

    createCondition(paramString, cond, value) {
        const scope = this;
        if (scope.animationController.params[paramString].constructor === SimpleTrigger) {
            return function() {
                return scope.animationController.params[paramString].checkTrigger();
            }
        } else {
            switch (cond) {
                case "if":
                case "equals":
                    return function() {
                        if (scope.animationController.params[paramString] === value) {
                            return true;
                        }
                        return false;
                    }
                case "ifnot":
                case "notequal":
                    return function() {
                        if (scope.animationController.params[paramString] !== value) {
                            return true;
                        }
                        return false;
                    }
                case "greater":
                    return function() {
                        if (scope.animationController.params[paramString] > value) {
                            return true;
                        }
                        return false;
                    }
                case "less":
                    return function() {
                        if (scope.animationController.params[paramString] < value) {
                            return true;
                        }
                        return false;
                    }
                default:
                    console.log("null condition");
                    return null;
            }
        }
    }
}

class AnimationState {
    constructor(animationLayer, name, animationAction, offset, animationSpeed, loop) {
        this.mixer = animationLayer.mixer;
        this.animationContoller = animationLayer.animationController;
        this.animationLayer = animationLayer;
        this.animationAction = animationAction; //can be null/undefined
        this.duration = 1; //the total duration of the state
        this.time = 1; //the current time animationAction is will update to 0 once it starts
        this.speed = animationSpeed == null ? 1 : animationSpeed
        this.offset = offset == null ? 0 : offset;
        this.isAnyState = false;

        this.fixedMotion = false;
        this.motionParamString = "";
        this.multParamString = "";
        this.offsetParamString = "";

        if (animationAction != null) {
            this.animationAction.loop = loop === true ? LoopRepeat : LoopOnce;
            this.animationAction.timeScale = this.speed;
            this.duration = animationAction.getClip().duration;
            this.animationAction.clampWhenFinished = true;
        }

        this._stateWeight = 0;
        this._effectiveWeight = 0;

        this._fadeFractionTime = 0;

        this._isFading = false;
        this._isTransitioning = false;
        this._transitionDuration = 0;
        this._transitionTime = 0;
        this._targetWeight = 0;

        this.name = name == null ? "" : name;


        this.transitions = [];
    }
    stop() {
        if (this.animationAction != null) {
            this.animationAction.stop();
        }
        this.setWeight(0);
    }
    play(offsetStart = 0) {
        this._updateEffectiveWeight();
        if (this.animationAction != null) {
            if (this.fixedMotion === false) {

                if (this.offsetParamString != "")
                    this.offset = this.animationContoller.params[this.offsetParamString];

                this.animationAction.time = offsetStart + (this.offset * this.duration);
                this.animationAction.play();
            } else {
                // IF FIXED MOTION IS SET TO TRUE, ANIMATION WILL BE HANDLED MANUALLY, SDO DONT PLAY() IT
                this.animationAction.time = this.offset * this.duration;
                this.animationAction.play();
                this.animationAction.paused = true;
            }
        }
    }
    pause(value) {
        if (this.animationAction != null) {
            this.animationAction.paused = value;
        }
    }
    createTransition(targetState, params) {
        const transition = new AnimationTransition(this.animationContoller, this, targetState, params);
        this.transitions.push(transition);
        return transition;
    }

    setSpeedMultiplierParameter(paramString) {
        if (this.animationContoller.params[paramString] != null)
            this.multParamString = paramString;
    }
    setOffsetParameter(paramString) {
        if (this.animationContoller.params[paramString] != null)
            this.offsetParamString = paramString;

    }
    setMotionParameter(paramString) {
        if (this.animationContoller.params[paramString] != null) {
            this.motionParamString = paramString;
            this.fixedMotion = true;
        }
    }

    _update(clockDelta, isNextState, isDropState) {
        //maybe not call it always?
        this._updateEffectiveWeight()

        //console.log(this._effectiveWeight);
        if (this.animationAction != null) {

            // IS SPEED CONTROLLERD BY ANIMATION CONTROLLER PARAMETERS?
            if (this.multParamString != "")
                this.animationAction.timeScale = this.speed * this.animationContoller.params[this.multParamString];

            // SECTION TO UPDATE TRANSITIONS CHECKS
            if (isDropState === false || isDropState == null) {
                // ANIMATIONS PLAYED NORMALLY
                if (this.animationAction.isRunning()) {
                    if (this.time > this.animationAction.time) {
                        this._resetTransitions();
                    }
                    this.time = this.animationAction.time;
                } else {

                    // MANUAL ANIMATIONS, THIS ANIMATIONS ARE CONTROLLED BY USER WITH THE CONTROLLER PARAMETERS, THE VALUE IN THE PARAMETER 
                    if (this.fixedMotion === true) {
                        let val = this.animationContoller.params[this.motionParamString];
                        if (val > 0.999) val = 0.99999;
                        if (val < 0) val = 0
                        this.animationAction.time = val * this.duration;
                    }

                    // ANIMATION IS NO LONGER PLAYING, BUT KEEP ON CHECKING IN CASE A TRANSITION HAPPENS
                    const timeScale = this.animationAction.timeScale * this.mixer.timeScale;
                    this.time += clockDelta * timeScale;
                    if (this.time > this.duration) {
                        this._resetTransitions();
                        this.time = 0;
                    }

                }
            }
        }

        // CHECK TRANSITIONS ONLY IF IT IS NOT A DROPPING STATE
        if (isDropState === false || isDropState == null) this._checkTransitions(isNextState);
        this._updateTransitionTime(clockDelta);
    }

    _updateTransitionTime(clockDelta) {

        if (this._isTransitioning === true) {
            this._transitionTime += clockDelta;
            if (this._isFading) {
                let weight = this._stateWeight + this._fadeFractionTime * clockDelta;
                if (weight < 0) weight = 0;
                if (weight > 1) weight = 1;
                this.setWeight(weight);
            }

            if (this._transitionTime >= this._transitionDuration) {
                this.setWeight(this._targetWeight);
                this._isTransitioning = false;
                this._isFading = false;
                this._transitionTime = 0;

            }
        }
    }

    _checkTransitions(isNextState) {

        if (this.animationLayer.currentTransition === null || this.isAnyState === true) {
            this._validateAllTransitions();

        } else {
            if (isNextState) {
                if (this.animationLayer.currentTransition.toBreaks === true) {
                    // "TO STATES" CAN VALIDATE NEW TRANSITIONS THAT BREAK CURRENT TRANSITIONS
                    this._validateAllTransitions();
                }
            } else {
                if (this.animationLayer.currentTransition.fromBreaks === true) {
                    // "FROM STATES" CAN BE ADAPTED TO CHECK ONLY MORE IMPORTANT TRANSITIONS FROM "TO STATE"
                    if (this.animationLayer.currentTransition.orderedBreak)
                        this._validateAllTransitions(this.animationLayer.currentTransitionindex + 1);
                    else
                        this._validateAllTransitions(0);
                }
            }
        }
    }
    _validateAllTransitions(startIndex = 0) {
        for (let i = startIndex; i < this.transitions.length; i++) {
            if (this.transitions[i].validate()) {
                this._callTransition(this.transitions[i]);
                break;
            }
        }
    }

    _callTransition(transition) {
        const duration = transition.fixedDuration === true ?
            transition.duration :
            (transition.duration * this.duration) / (this.speed * this.mixer.timeScale); // multiply it by modifier if exists

        const targetState = transition.targetState;

        const offset = transition.offset * targetState.duration; // OFFSET IS NORMALIZED, MULTIPLY IT WITH DURATION
        this.animationLayer.switchToState(transition.targetState, duration, offset, transition);
    }

    _resetTransitions() {
        for (let i = 0; i < this.transitions.length; i++) {
            this.transitions[i].resetLoop();
        }
    }

    crossFadeTo(targetState, duration, offset) {
        targetState.play(offset);

        this._startTransitionCounter(duration);
        targetState._startTransitionCounter(duration);

        if (this.animationAction == null) {
            // IF INITIAL STATE ANIMATION ACTION IS NULL, CHANGE THE WEIGHT AT ONCE\
            this._fadeFractionTime = 0;
            this._setTargetWeight(true, 0);
            targetState._fadeFractionTime = 0;
            targetState._setTargetWeight(true, 1);
        } else if (targetState.animationAction == null) {
            // IF TARGET STATE ANIMATION ACTION IS NULL, CHANGE THE WEIGHT ONCEC IT FINISHES TRANSITIONING
            this._fadeFractionTime = 0;
            this._setTargetWeight(false, 0);
            // MAKE SURE FADE FRACTION TIME IS 0, IN TRANSITIONS IT CAN STILL HAVE A VALUE FROM, BEFORE
            targetState._fadeFractionTime = 0;
            targetState._setTargetWeight(false, 1);

        } else {
            // WHEN BOTH ANIMATION ACTION EXIST
            this._setTargetWeight(false, 0);
            targetState._setTargetWeight(false, 1);

            // FOR CURRENT STATE, DONT CHANGE CURRENT WEIGHT, BUT RECALCULATE ITS SPEED WITH ITS CURRENT WEIGHT WITH THE DESIRED TIME TO HAPPEN THE TRANSITION
            this._fadeFractionTime = -this._stateWeight / duration;
            this._isFading = true;

            // FOR TARGET STATE TOO, BUT INVERSE (1-WEIGHT)
            targetState._fadeFractionTime = (1 - targetState._stateWeight) / duration;
            targetState._isFading = true;
        }


    }

    // CROSS FADE TO REMOVE
    _crossFadeOff(duration) {
        //console.log("fade off");
        this._setTargetWeight(false, 0);
        this._startTransitionCounter(duration);
        this._fadeFractionTime = -this._stateWeight / duration;
        this._isFading = true;
    }

    _weightOff(onStart, duration) {
        console.log(onStart);
        this._isFading = false;
        this._fadeFractionTime = 0;
        if (onStart) {
            this._setTargetWeight(true, 0);
            console.log(this._stateWeight);
        } else {
            this._startTransitionCounter(duration);
            this._setTargetWeight(false, 0);
        }
    }

    _resetFadeTime(duration, isNextState) {
        this._startTransitionCounter(duration);
        if (isNextState === true) {
            this._fadeFractionTime = (1 - this._stateWeight) / duration;
        } else {
            this._fadeFractionTime = -this._stateWeight / duration
        }
    }

    _setTargetWeight(abruptChange, targetWeight) {
        this._targetWeight = targetWeight;
        if (abruptChange === true)
            this.setWeight(targetWeight);
    }

    _startTransitionCounter(duration) {

        // TRANSITION COUNTER DEFINED FROM TRANSITION DURATION TIME
        this._transitionDuration = duration;
        this._transitionTime = 0;
        this._isTransitioning = true;

    }

    setWeight(value) {
        this._stateWeight = value;
        this._updateEffectiveWeight();
    }

    _updateEffectiveWeight() {

        // EFFECTIVE STATE WEIGHTS DEPEND ON THE LAYER IT BELONGS
        this._effectiveWeight = this._stateWeight * this.animationLayer._effectiveWeight;
        if (this.animationAction != null)
            this.animationAction.weight = this._effectiveWeight;
    }


}

class AnimationLayer {
    constructor(animationController, name, weight = 0, additiveBlend = false) {
        this.animationController = animationController;

        this.mixer = animationController.mixer;
        this.name = name == null ? "" : name;

        this.additiveBlend = additiveBlend;

        this.weight = weight;


        // IF CURRENT STATE HAS ANIMATION ACTION NULL, IT MODIFIES THE LAYER WEIGHT TO 0
        this._stateWeightModifier = 1;
        this._effectiveWeight = 1;
        this._overrideWeightValue = 1;
        this._lastLayer = null;
        this._isBaseLayer = false;

        this._isTransitioning = false;
        this._transitionDuration = 0;
        this._transitionTime = 0;
        this._isFading = false;
        this._fadeFractionTime = 0;
        this._targetWeight = 1;

        this.animationStates = [];

        // BASIC STATES: ENTRY AND ANYSTATE
        this.entryEmptyState = new AnimationState(this, "entry/exit"); //empty state
        this.anyEmptyState = new AnimationState(this, "any"); //empty state
        this.anyEmptyState.isAnyState = true;

        this.currentState = this.entryEmptyState;
        this.currentStateTemp = null; // SAVES THE STATE WHEN CURRENT STATE GOES TO TARGET STATE
        this.nextState = null
        this.droppingStates = null

        this.currentTransition = null;
        this.currentTransitionindex = -1;
        this.randValid = 0;
    }




    _update(clockDelta) {
        //console.log(this._effectiveWeight);
        //console.log();
        //if (this._isBaseLayer === false)
        this._updateTransitionTime(clockDelta);

        // ANY EMPTY STATES HAS PRIORITY OVER CURRENT STATE IN TRANSITIONS
        this.anyEmptyState._update(clockDelta);

        if (this.currentTransition != null) {
            // DROPPING STATES ARE THOSE THAT ARE CALLED WHEN AN INTERRUPTION HAPPENS, IF NO INTERRUPTION HAPPENS, THEN DROPPING STATES WILL BE NULL
            if (this.droppingStates != null) {
                this.droppingStates.forEach(state => {
                    // ONLY LOWER THE WEIGHT WITH THIS SPECIAL UPDATE
                    state._update(clockDelta, false, true);
                });
            }

            // TRANSITION WILL DEFINE WHO CAN BREAK IT FIRST, THE CURRENT TRANSITION TRANSITIONS OR THE NEXT TRANSITION TRANSITIONS, FROM = CURRENT
            if (this.currentTransition.fromPriority === true) this.currentState._update(clockDelta);
            this.nextState._update(clockDelta, true);
            if (this.currentTransition.fromPriority === false) this.currentState._update(clockDelta);

        } else {

            //IF NO TRANSITION IS HAPPENING, JUST UPDATE THE CURRENT STATE
            this.currentState._update(clockDelta);
        }
    }

    // IF NOT ADDITIVE LAYER, THEY DEPEND ON WEIGHT FROM PREVIOUS LAYERS
    _updateEffectiveWeight() {
        if (this._lastLayer == null) { // LAYER ON BOTTOM
            if (this._isBaseLayer) this._effectiveWeight = this.weight
            else this._effectiveWeight = this.weight * this._stateWeightModifier;

            if (this.additiveBlend === false) this._overrideWeightValue = 1 - this._effectiveWeight; //0.5
            else this._overrideWeightValue = 1;
        } else {
            if (this.additiveBlend === false) {
                this._effectiveWeight = this._lastLayer._overrideWeightValue * this.weight * this._stateWeightModifier;
                this._overrideWeightValue = this._lastLayer._overrideWeightValue - this._effectiveWeight;
            } else {
                this._effectiveWeight = this.weight * this._stateWeightModifier;
                this._overrideWeightValue = this._lastLayer._overrideWeightValue;
            }
        }
    }

    _updateTransitionTime(clockDelta) {

        if (this._isTransitioning === true) {
            this._transitionTime += clockDelta;
            if (this._isFading === true) {
                let weight = this._stateWeightModifier + this._fadeFractionTime * clockDelta;
                if (weight < 0) weight = 0;
                if (weight > 1) weight = 1;
                this._stateWeightModifier = weight;
            }
            if (this._transitionTime >= this._transitionDuration) {
                this._setLayerWeightModifier(this._targetWeight)
            }
        }
    }

    // CALLED ONLY ONCE WHEN STARTS
    _setupDefaultValues(lastLayer) {
        this._lastLayer = lastLayer;
        this.currentState._stateWeight = 1;
        // CHANGE LAYER WEIGHT: IF THE INITIAL STATE IS NULL, SET IT TO 0, UNLESS IS THE BASE LAYER, BASE LAYER IS ALWAYS WITH WEIGHT OF 1
        if (this.currentState.animationAction == null)
            this._setLayerWeightModifier(0);

        // CALL PLAY ON INITIAL STATE
        this.currentState.play();
    }

    // CREATE LAYER STATES
    createState(name, offset, speed, loop, animationClip) {
        let animstate;
        if (animationClip != null) {
            const action = this.mixer.clipAction(animationClip);
            animstate = new AnimationState(this, name, action, offset, speed, loop);
        } else {
            animstate = new AnimationState(this, name, null, offset, speed, loop);
        }
        this.animationStates.push(animstate);

        return animstate;
    }

    // CREATE DEFAULT TRANSITION STATES
    createAnyStateTransition(targetState, params) {
        return this.anyEmptyState.createTransition(targetState, params);
    }
    createEntryTransition(targetState, params) {
        return this.entryEmptyState.createTransition(targetState, params);
    }
    setInitialState(targetState) {
        this.currentState = targetState;
    }

    // TRANSITION TO ANOTHER STATE
    switchToState(targetState, duration, offset, transition) {

        const scope = this;
        const rand = Math.random();
        this.randValid = rand;


        setTimeout(function() {
            if (scope.randValid === rand) { // RANDOM VALUE USED TO KNOW IF NO OTHER TRANSITION WAS TRIGGERED WHILE THIS TRANSITION HAPPENED
                if (scope.currentState !== scope.nextState) {
                    scope.currentState.stop();
                }
                scope.currentTransition = null;

                if (scope.droppingStates != null) {
                    scope.droppingStates.forEach(state => {
                        if (state !== scope.nextState)
                            state.stop();
                    });
                }
                scope.currentState = scope.nextState;
                scope.nextState = null;
                scope.currentTransitionindex = -1;
                scope.droppingStates = null;
            }
        }, duration * 1000);

        // CROSS FADE DEPENDING ON TARGET STATE WETHER IS NULL OR NOT
        this._crossFadeLayer(targetState, duration);


        // RESET TRANSITION DURATION ON CURRENTSTATE AND TARGETSTATE IF TARGET STATE IS THE SAME, AND THE CURRENT STATE IS DIFFERENT FROM TARGET STATE
        if (targetState === scope.nextState && this.currentState !== targetState) {
            // UNLESS ITS THE SAME AS CURRENT STATE
            targetState._resetFadeTime(duration, true);
            scope.currentState._resetFadeTime(duration, false);

        } else {

            // SAVE CURRENT TRANSITION
            scope.currentTransition = transition;
            scope.currentTransitionindex = scope.currentState.transitions.indexOf(transition);
            if (this.currentState !== targetState) scope.currentState.crossFadeTo(targetState, duration, offset);
            else {
                scope.currentState.crossFadeTo(targetState, duration, offset);
                //STILL TRYING to FIGURE A WAY TO LERP IT DOWN
                //scope._cloneState(scope.currentState);
            }

        }

        // MEANS THERE WAS ALREADY A TRANSITION GOING ON
        if (scope.nextState != null) {
            if (scope.currentState !== targetState)
                scope.currentState.pause(true);

            if (this.droppingStates == null)
                this.droppingStates = [];


            if (scope.nextState !== targetState) {
                // IF TARGET STATE IS IN THE LIST OF DROPPING STATES, REMOVE IT FROM THE DROPPING LIST
                const indexState = this.droppingStates.indexOf(targetState);
                if (indexState !== -1) this.droppingStates.splice(indexState, 1);

                // CHECK IF THE CURRENT "NEXT STATE" IS NOT ALREADY IN THE LIST, ADD IT IF ITS MISSING TO DROP IT
                const index = this.droppingStates.indexOf(scope.nextState);
                if (index === -1) this.droppingStates.push(scope.nextState);

                scope.nextState.pause(true);
            }
            //console.log(this.droppingStates);


            if (scope.currentState.animationAction == null && targetState.animationAction != null) {
                // CHANGE ABRUPTLY ON BEGINING
                this.droppingStates.forEach(state => {
                    state._weightOff(true);
                });
            } else if (targetState.animationAction == null && scope.currentState.animationAction != null) {
                // CHANGE ABRUPTLY ON END
                this.droppingStates.forEach(state => {
                    state._weightOff(false, duration);
                });
            } else {
                // MAKE A SMOOTH TRANSITION
                this.droppingStates.forEach(state => {
                    state._crossFadeOff(duration);

                });
            }
        }

        targetState.pause(false);

        scope.nextState = targetState;
    }

    _crossFadeLayer(nextState, duration) {
        // IF CURRENT STATE AND NEXT STATE 
        if (nextState.animationAction != null && this.currentState.animationAction != null) {
            this._setLayerWeightModifier(1);
        } else if (nextState.animationAction == null && this.currentState.animationAction == null) {
            this._setLayerWeightModifier(0);
        } else {
            if (nextState.animationAction == null) {
                this._targetWeight = 0;
                if (this._stateWeightModifier !== 0) {
                    this._fadeFractionTime = -this._stateWeightModifier / duration;
                } else this._fadeFractionTime = 0;
            } else {
                this._targetWeight = 1;
                if (this._stateWeightModifier !== 1) this._fadeFractionTime = (1 - this._stateWeightModifier) / duration;
                else this._fadeFractionTime = 0;

            }
            this._startTransitionCounter(duration);
            this._isFading = true;
        }
    }
    _startTransitionCounter(duration) {
        this._transitionDuration = duration;
        this._transitionTime = 0;
        this._isTransitioning = true;
    }

    _setLayerWeightModifier(weight) {
        this._stateWeightModifier = weight;
        this._isTransitioning = false;
        this._isFading = false;
        this._transitionTime = 0;
    }


}

class AnimationController {
    constructor(name, root, parametersArray) {


        //setup all parameters
        this._played = false;
        this.name = name == null ? "" : name;
        this.params = {};
        this.triggers = [];
        if (parametersArray != null) {
            parametersArray.forEach(element => {
                const prop = Object.getOwnPropertyNames(element)[0];
                this.params[prop] = element[Object.keys(element)[0]];

                if (this.params[prop].constructor === Object) {
                    this.params[prop] = new SimpleTrigger(this.params[prop].value);
                    this.triggers.push(this.params[prop]);
                }
            });
        }
        // ONLY 1 MIXER CONTROLS THE ANIMATION CONTROLLER
        this.mixer = new AnimationMixer(root);
        //this.mixer.timeScale = 10;

        //Set at least a base Layer
        this.animationLayers = [];
        //testing();


        const scope = this;

        function testing() {
            //console.log("yay im testing!");
            document.addEventListener('keydown', callKey);
        }

        function callKey(e) {
            //console.log(e.code);
            if (e.code === "ArrowLeft") {
                scope.setTrigger("trig2");
                console.log("setTrigger('trig2')");
                //scope.setParam("movenext", true);
                //console.log("setParam('movenext',true), current value is: " + scope.getParam("movenext"));
                //console.log("left!")
            }
            if (e.code === "ArrowRight") {
                scope.setParam("movenext", false);
                console.log("setParam('movenext',false)");
                //console.log("right!")
            }
            if (e.code === "KeyO") {
                scope.setParam("speed_pa", scope.getParam("speed_pa") + 0.2);
                console.log("setParam('speed_pa', += 0.2), current value is: " + scope.getParam("speed_pa"));
                //console.log("right!")
            }
            if (e.code === "KeyU") {
                scope.setParam("motion_pa", scope.getParam("motion_pa") + 0.05);
                console.log("setParam('motion_pa', += 0.01), current value is: " + scope.getParam("motion_pa"));
                //console.log("right!")
            }
            if (e.code === "KeyI") {
                scope.setParam("cycle_pa", scope.getParam("cycle_pa") + 0.1);
                console.log("setParam('cycle_pa', += 0.1), current value is: " + scope.getParam("cycle_pa"));
                //console.log("right!")
            }
            if (e.code === "KeyE") {
                console.log("getParam('movenext'), current value is: " + scope.getParam("movenext"));
                //console.log("right!")
            }
            if (e.code === "ArrowUp") {
                //console.log("clicked up");
                //console.log("called: setTrigger('trig')");
                scope.setTrigger("trig");
                console.log("setTrigger('trig')");

            }
            if (e.code === "ArrowDown") {
                //console.log("clicked down");
                //console.log("called: setTrigger('trig')");
                scope.resetTrigger("trig");
                console.log("resetTrigger('trig'), current value is: " + scope.getParam("trig"));
            }
            if (e.code === "KeyQ") {
                //console.log("clicked down");
                //console.log("called: setTrigger('trig')");
                console.log("getParam('trig'), current value is: " + scope.getParam("trig"));
            }

            if (e.code === "KeyT") {
                //console.log("clicked up");
                //console.log("called: setTrigger('trig')");
                scope.setTrigger("trig2");
                console.log("setTrigger('trig2'), current value is: " + scope.getParam("trig2"));

            }
        }

    }

    //call this from outside
    update(clockDelta) {
        this._setupDefaultValues();

        this._updateLayers(clockDelta);
        this._updateTriggers();
        this.mixer.update(clockDelta);


    }
    _updateTriggers() {
        this.triggers.forEach(trigger => {
            trigger.triggerPass();
        });
    }
    _updateLayers(clockDelta) {
        for (let i = this.animationLayers.length - 1; i >= 0; i--) {
            this.animationLayers[i]._updateEffectiveWeight();
        }
        this.animationLayers.forEach(layer => {
            layer._update(clockDelta);
        });
    }
    _setupDefaultValues() {
        if (this._played === false) {
            this._setupLayersDefaultValues();
            this._played = true;
        }
    }
    _setupLayersDefaultValues() {
        for (let i = 0; i < this.animationLayers.length; i++) {
            if (i === 0) {
                this.animationLayers[i].weight = 1;
                this.animationLayers[i]._isBaseLayer = true;
            }

            if (i < this.animationLayers.length - 1)
                this.animationLayers[i]._setupDefaultValues(this.animationLayers[i + 1]);
            else {
                this.animationLayers[i]._setupDefaultValues(null);
            }
        }
    }

    createLayer(name, weight = 1, additiveBlend = false) {
        const newLayer = new AnimationLayer(this, name, weight, additiveBlend);
        this.animationLayers.push(newLayer);
        return newLayer;
    }

    setTrigger(paramName) {
        const param = this.params[paramName];
        if (param != null) {
            if (param.constructor === SimpleTrigger) {
                param.trigger = true;
            } else {
                console.warn("Calling setTrigger() on non a trigger type Object.");
            }
        } else {
            console.warn(`No trigger/parameter with name: ${paramName} was found`);
        }
    }
    resetTrigger(paramName) {
        const param = this.params[paramName];
        if (param != null) {
            if (param.constructor === SimpleTrigger) {
                param.trigger = false;
            } else {
                console.warn("Calling Trigger resetTrigger() on non a trigger type Object.");
            }
        } else {
            console.warn(`No trigger/parameter with name: ${paramName} was found`);
        }
    }

    setParam(paramName, value) {
        const param = this.params[paramName];
        if (param != null) {
            if (param.constructor !== SimpleTrigger) {
                this.params[paramName] = value; //check if correct
                //console.log(param); //check how to set it here
                // param = value or param.value = value
            } else {
                console.warn('Calling setParam() on Trigger parameters');
            }
        } else {
            console.warn(`Parameter with name ${paramName} does not exist in Animation Controller`);
        }
    }

    getParam(paramName) {
        const param = this.params[paramName];
        if (param != null) {
            if (param.constructor !== SimpleTrigger) {
                return param;
            } else {
                return param.trigger;
            }
        } else {
            console.warn(`Parameter with name ${paramName} does not exist in Animation Controller`);
        }
    }
}

class SimpleTrigger {
    constructor(startValue) {
        this.trigger = startValue === undefined ? false : startValue; //unless the user wants it to start with true, set it to false
        this.passed = false;
    }

    checkTrigger() {
        if (this.trigger === true) {
            this.passed = true;
            return true;
        }
        return false;
    }
    triggerPass() {
        if (this.passed === true) {
            console.log("Animation Action ended, and trigger is true, moving to next animation state, and setting trigger to false")
            this.passed = false;
            this.trigger = false;
        }

    }

}

export { AnimationController, AnimationLayer, AnimationState, AnimationTransition }