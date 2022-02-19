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

        this.conditions.forEach(fn => {
            if (fn() === false) return false;
        });
        return true;
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
    constructor(animationLayer, animationAction, offset, animationSpeed, loop, name) {
        this.mixer = animationLayer.mixer;
        this.animationContoller = animationLayer.animationController;
        this.animationLayer = animationLayer;
        this.animationAction = animationAction; //can be null/undefined
        this.duration = 0; //the total duration of the state
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

        this._fadeFractionTime = 0;
        this._isFading = false;
        this._fadeTo = 0;

        this.name = name == null ? "" : name;

        this.transitions = [];
    }
    stop() {
        if (this.animationAction != null) {
            this.animationAction.stop();
        }
    }
    play(offsetStart = 0) {
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

    update(clockDelta, isLastState) {
        if (this.animationAction != null) {
            this.animationAction.weight = this._stateWeight;
            if (this.multParamString != "")
                this.animationAction.timeScale = this.speed * this.animationContoller.params[this.multParamString];

            //NORMAL ANIMATIONS
            if (this.animationAction.isRunning()) {
                if (this.time > this.animationAction.time) {
                    this.resetTransitions();
                }
                this.time = this.animationAction.time;
            } else {

                // MANUAL ANIMATIONS, MUST BE CONTROLLED BY PARAMETER
                if (this.fixedMotion === true) {
                    let val = this.animationContoller.params[this.motionParamString];
                    if (val > 0.999) val = 0.99999;
                    if (val < 0) val = 0
                    this.animationAction.time = val * this.duration;
                }
                // FINISHED ANIMATION
                const timeScale = this.animationAction.timeScale * this.mixer.timeScale;
                this.time += clockDelta * timeScale;
                if (this.time > this.duration) {
                    this.resetTransitions();
                    this.time = 0;
                }

            }
        }

        this.checkTransitions(isLastState);

        if (this._isFading === true) this._updateWeight(clockDelta);
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

    checkTransitions(isLastState) {
        // make sure there is currently no transition happening
        // check from layer, any state also has to know that there is currently no transition 
        // any state doesnt give a shit, if its any state, omit first validation

        if (this.animationLayer.currentTransition === null || this.isAnyState === true) {
            this.validateAllTransitions();

        } else {
            if (isLastState) {
                if (this.animationLayer.currentTransition.fromBreaks === true) {
                    if (this.animationLayer.currentTransition.orderedBreak)
                        this.validateAllTransitions(this.animationLayer.currentTransitionindex + 1, this.animationLayer.currentTransitionindex); // be sure to ignore the current transition index, only here
                    else
                        this.validateAllTransitions(0, this.animationLayer.currentTransitionindex);

                    console.log("from state");
                }
            } else {
                if (this.animationLayer.currentTransition.toBreaks === true) {
                    this.validateAllTransitions(); // this one validates all transitions
                    console.log("to state");
                }
            }
        }
    }
    validateAllTransitions(startIndex = 0, ignoreIndex = -1) {
        for (let i = startIndex; i < this.transitions.length; i++) {
            if (i !== ignoreIndex) {
                if (this.transitions[i].validate()) {
                    this.callTransition(this.transitions[i]);
                    break;
                }
            }
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
        this._fadeOut(duration);
        targetState._fadeIn(duration);

        targetState.play(offset);

    }

    _fadeIn(duration) {
        this._setInitialFadeWeight(0);
        this._scheduleFading(1 / duration, 1);
    }

    _fadeOut(duration) {
        this._setInitialFadeWeight(1);
        this._scheduleFading(-1 / duration, 0);
    }

    _setInitialFadeWeight(weight) {
        this._stateWeight = weight;
        if (this.animationAction != null)
            this.animationAction.weight = weight;
    }

    _scheduleFading(fractionTime, targetWeight) {
        if (targetWeight !== this._stateWeight) {
            this._fadeFractionTime = fractionTime;
            this._isFading = true;
            this._fadeTo = targetWeight;
        }
    }

    _updateWeight(clockDelta) {
        let weight = this._stateWeight + this._fadeFractionTime * clockDelta;

        if (weight < 0) {
            weight = 0;
            this._isFading = false;
            this.stop();
        }
        if (weight > 1) {
            weight = 1;
            this._isFading = false;
        }
        this._stateWeight = weight;
    }


}

class AnimationLayer { // top layer of animation
    constructor(animationController, name, weight = 0, additiveBlend = false) {
        this.animationController = animationController;

        this.played = false;
        this.mixer = animationController.mixer;
        this.name = name == null ? "" : name;

        this.additiveBlend = additiveBlend;
        this.weight = weight;
        this.animationStates = [];

        // basic animation states
        this.entryEmptyState = new AnimationState(this); //empty state
        this.entryEmptyState.name = "entry/exit"
        this.anyEmptyState = new AnimationState(this); //empty state
        this.anyEmptyState.isAnyState = true;
        this.anyEmptyState.name = "any"


        this.currentState = this.entryEmptyState;
        this.lastState = null;

        this.currentTransition = null;
        this.currentTransitionindex = -1;
        this.randValid = 0;
    }

    update(clockDelta) {
        // SET DEFAULT VALUES BEFORE FIRST UPDATE CALL
        if (this.played === false) {
            this.currentState._stateWeight = 1;
            this.currentState.play();
            this.played = true;
            console.log(this.animationController);
        }

        this.anyEmptyState.update(clockDelta);

        if (this.currentTransition != null) {
            if (this.currentTransition.fromPriority === true) this.lastState.update(clockDelta, true);
            this.currentState.update(clockDelta);
            if (this.currentTransition.fromPriority === false) this.lastState.update(clockDelta, true);
        } else {
            this.currentState.update(clockDelta);
        }
    }

    // CREATE LAYER STATES
    createState(name, offset, speed, loop, animationClip) {
        let animstate = null;
        if (animationClip != null) {
            const action = this.mixer.clipAction(animationClip);
            animstate = new AnimationState(this, action, offset, speed, loop, name);
        } else {
            animstate = new AnimationState(this, null, offset, speed, loop, name);
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
                scope.lastState = null;
                scope.currentTransitionindex = -1;
            }
        }, duration * 1000);

        scope.currentTransition = transition;
        scope.currentTransitionindex = scope.currentState.transitions.indexOf(transition);
        scope.currentState.crossFadeTo(targetState, duration, offset)
        scope.lastState = scope.currentState;
        scope.currentState = targetState;
    }


}

class AnimationController {
    constructor(name, root, parametersArray) {

        //setup all parameters
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

                scope.setParam("movenext", true);
                console.log("setParam('movenext',true), current value is: " + scope.getParam("movenext"));
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
        this.mixer.update(clockDelta);
        this.animationLayers.forEach(layers => {
            layers.update(clockDelta);
        });
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