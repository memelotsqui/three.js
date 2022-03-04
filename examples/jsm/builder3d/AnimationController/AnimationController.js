import {
    AnimationMixer,
    LoopOnce,
    LoopRepeat
} from 'three';

class AnimationTransition { //transitions bewtween 2 states Maybe transitions can go in "animation state" step of json
    constructor(animationController, fromState, targetState, params) {
        params = params == null ? {} : params;
        console.log(params);

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
        console.log("called stop on: " + this.name);
        this.setWeight(0);
    }
    play(offsetStart = 0) {
        this._updateEffectiveWeight();
        console.log(this._stateWeight);
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
    createTransition(targetState, params) {
        const transition = new AnimationTransition(this.animationContoller, this, targetState, params);
        this.transitions.push(transition);
        return transition;
    }

    _update(clockDelta, isNextState, isDropState) {
        this._updateEffectiveWeight()
        if (this.animationAction != null) {

            // IS SPEED CONTROLLERD BY ANIMATION CONTROLLER PARAMETERS?
            if (this.multParamString != "")
                this.animationAction.timeScale = this.speed * this.animationContoller.params[this.multParamString];

            // SECTION TO UPDATE TRANSITIONS CHECKS
            if (isDropState === false || isDropState == null) {
                // ANIMATIONS PLAYED NORMALLY
                if (this.animationAction.isRunning()) {
                    if (this.time > this.animationAction.time) {
                        this.resetTransitions();
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
                        this.resetTransitions();
                        this.time = 0;
                    }

                }
            }
        }

        // CHECK TRANSITIONS ONLY IF IT IS NOT A DROPPING STATE
        if (isDropState === false || isDropState == null) this.checkTransitions(isNextState);
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

    checkTransitions(isNextState) {
        // make sure there is currently no transition happening
        // check from layer, any state also has to know that there is currently no transition 
        // any state doesnt give a shit, if its any state, omit first validation

        if (this.animationLayer.currentTransition === null || this.isAnyState === true) {
            this.validateAllTransitions();

        } else {
            if (isNextState) {
                if (this.animationLayer.currentTransition.toBreaks === true) {
                    this.validateAllTransitions(); // this one validates all transitions
                }
            } else {
                if (this.animationLayer.currentTransition.fromBreaks === true) {
                    if (this.animationLayer.currentTransition.orderedBreak)
                        this.validateAllTransitions(this.animationLayer.currentTransitionindex + 1);
                    else
                        this.validateAllTransitions(0);
                }
            }
        }
    }
    validateAllTransitions(startIndex = 0) {
        for (let i = startIndex; i < this.transitions.length; i++) {
            //if (i !== ignoreIndex) {
            if (this.transitions[i].validate()) {
                console.log("transition passed");
                this.callTransition(this.transitions[i]);
                break;
            }
            //}
        }
    }
    callTransition(transition) {
        const duration = transition.fixedDuration === true ?
            transition.duration :
            (transition.duration * this.duration) / (this.speed * this.mixer.timeScale); //multiply it by modifier if exists

        const targetState = transition.targetState;

        const offset = transition.offset * targetState.duration; // OFFSET IS NORMALIZED, MULTIPLY IT WITH DURATION
        this.animationLayer.switchToState(transition.targetState, duration, offset, transition);
    }
    resetTransitions() {
        for (let i = 0; i < this.transitions.length; i++) {
            this.transitions[i].resetLoop();
        }
    }

    crossFadeTo(targetState, duration, offset) {
        targetState.play(offset);

        this._startTransitionCounter(duration);
        targetState._startTransitionCounter(duration);

        console.log("from: " + this.name);
        console.log("to: " + targetState.name);
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

    _resetFadeTime(duration) {
        this._startTransitionCounter(duration);
        this._fadeFractionTime = (1 - this._stateWeight) / duration;
    }

    _setTargetWeight(abruptChange, targetWeight) {
        this._targetWeight = targetWeight;
        if (abruptChange === true)
            this.setWeight(targetWeight);
    }

    _startTransitionCounter(duration) {
        this._transitionDuration = duration;
        this._transitionTime = 0;
        this._isTransitioning = true;
    }

    setWeight(value) {
        //TEST HERE
        this._stateWeight = value;
        this._updateEffectiveWeight();
    }

    _updateEffectiveWeight() {
        //console.log("state: " + this.name + "layer " + this.animationLayer.name + "  " + this.animationLayer._effectiveWeight);
        this._effectiveWeight = this._stateWeight * this.animationLayer._effectiveWeight;
        //console.log("state: " + this.name + " weight: " + this._effectiveWeight);
        if (this.animationAction != null)
            this.animationAction.weight = this._effectiveWeight;
    }


}

class AnimationLayer { // top layer of animation
    constructor(animationController, name, weight = 0, additiveBlend = false) {
        this.animationController = animationController;

        this.mixer = animationController.mixer;
        this.name = name == null ? "" : name;

        this.additiveBlend = additiveBlend;

        this.weight = weight;

        this._effectiveWeight = 1;
        this._overrideWeightValue = 1;
        this._lastLayer = null;

        this.animationStates = [];

        // BASIC STATES: ENTRY AND ANYSTATE
        this.entryEmptyState = new AnimationState(this, "entry/exit"); //empty state
        this.anyEmptyState = new AnimationState(this, "any"); //empty state
        this.anyEmptyState.isAnyState = true;



        this.currentState = this.entryEmptyState;
        this.nextState = null
        this.droppingStates = null

        this.currentTransition = null;
        this.currentTransitionindex = -1;
        this.randValid = 0;
    }

    _updateEffectiveWeight() {
        if (this._lastLayer == null) { // LAYER ON BOTTOM
            this._effectiveWeight = this.weight;
            if (this.additiveBlend === false) this._overrideWeightValue = 1 - this.weight; //0.5
            else this._overrideWeightValue = 1;
        } else {
            if (this.additiveBlend === false) {
                this._effectiveWeight = this._lastLayer._overrideWeightValue * this.weight;
                this._overrideWeightValue = this._lastLayer._overrideWeightValue - this._effectiveWeight;
            } else {
                this._overrideWeightValue = this._lastLayer._overrideWeightValue;
                this._effectiveWeight = this.weight;
            }
        }
    }

    _update(clockDelta) {

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
    _setupDefaultValues(lastLayer) {
        this.currentState._stateWeight = 1;
        this.currentState.play();
        this._lastLayer = lastLayer;
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
                scope.currentTransition = null;
                scope.currentState.stop();
                if (scope.droppingStates != null) {
                    scope.droppingStates.forEach(state => {
                        if (state !== scope.nextState)
                            state.stop();
                    });
                }
                scope.currentState = scope.nextState;
                scope.currentTransitionindex = -1;
                scope.droppingStates = null;
                console.log("finished");
            }
        }, duration * 1000);


        if (targetState === scope.nextState) {
            targetState._resetFadeTime(duration);
        } else {

            // SAVE CURRENT TRANSITION
            scope.currentTransition = transition;
            scope.currentTransitionindex = scope.currentState.transitions.indexOf(transition);
            scope.currentState.crossFadeTo(targetState, duration, offset);

        }

        // MEANS THERE WAS ALREADY A TRANSITION GOING ON
        if (scope.nextState != null) {

            if (this.droppingStates == null)
                this.droppingStates = [];

            // IF TARGET STATE IS IN THE LIST OF DROPPING STATES, REMOVE IT FROM THE DROPPING LIST
            const indexState = this.droppingStates.indexOf(targetState);
            if (indexState !== -1) this.droppingStates.splice(indexState, 1);

            // CHECK IF THE CURRENT "NEXT STATE" IS NOT ALREADY IN THE LIST, ADD IT IF ITS MISSING TO DROP IT
            const index = this.droppingStates.indexOf(scope.nextState);
            if (index === -1) this.droppingStates.push(scope.nextState);

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

        scope.nextState = targetState;
    }
}

class AnimationController {
    constructor(name, root, parametersArray) {


        //setup all parameters
        this._played = false;
        this.name = name == null ? "" : name;
        this.params = {};
        if (parametersArray != null) {
            parametersArray.forEach(element => {
                const prop = Object.getOwnPropertyNames(element)[0];
                this.params[prop] = element[Object.keys(element)[0]];

                if (this.params[prop].constructor === Object) {
                    this.params[prop] = new SimpleTrigger(this.params[prop].value);
                }
            });
        }

        //only 1 mixer that will control all layers/states
        this.mixer = new AnimationMixer(root);
        //this.mixer.timeScale = 10;

        //Set at least a base Layer
        this.animationLayers = [];
        testing();


        const scope = this;

        function testing() {
            //console.log("yay im testing!");
            document.addEventListener('keydown', callKey);
        }

        function callKey(e) {
            //console.log(e.code);
            if (e.code === "ArrowLeft") {
                scope.setTrigger("trig2");
                console.log("setTrigger('trig2'), current value is: " + scope.getParam("trig2"));
                //scope.setParam("movenext", true);
                //console.log("setParam('movenext',true), current value is: " + scope.getParam("movenext"));
                //console.log("left!")
            }
            if (e.code === "ArrowRight") {
                scope.setParam("movenext", false);
                console.log("setParam('movenext',false), current value is: " + scope.getParam("movenext"));
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
                console.log("setTrigger('trig'), current value is: " + scope.getParam("trig"));

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
        this.mixer.update(clockDelta);


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
            if (i < this.animationLayers.length - 1)
                this.animationLayers[i]._setupDefaultValues(this.animationLayers[i + 1]);
            else
                this.animationLayers[i]._setupDefaultValues(null);
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
                console.error('Calling setParam() on Trigger parameters');
            }
        } else {
            console.error(`Parameter with name ${paramName} does not exist in Animation Controller`);
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
            console.error(`Parameter with name ${paramName} does not exist in Animation Controller`);
        }
    }
}

class SimpleTrigger {
    constructor(startValue) {
        this.trigger = startValue === undefined ? false : startValue; //unless the user wants it to start with true, set it to false
    }

    checkTrigger() {
        if (this.trigger === true) {
            console.log("Animation Action ended, and trigger is true, moving to next animation state, and setting trigger to false")
            this.trigger = false;
            return true;
        }
        return false;
    }
}

export { AnimationController, AnimationLayer, AnimationState, AnimationTransition }