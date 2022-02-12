// let animationClip = AnimationClip(); ///from outside

// //order:
// //create AnimationMaster (Most important, with basic attributes)
// const root = {};
// let animationController = new AnimationController(root, [{ "": 0 }, {}, {}]);
// let animationLayer = animationController.addLayer("BaseLayer");
// let animationState = animationLayer.addState(animationClip, 1);
// let animationTransition = animationLayer.animationStates[0].addTransition(animationLayer.animationStates[1]);
// animationTransition.addCondition(animationController.params[0], "if", 3.0)
//     //create Additional Animation States

// //create Custom Animation Transitions
// //create Custom Layers
import {AnimationMixer,
LoopOnce,
LoopRepeat} from 'three';

class AnimationTransition { //transitions bewtween 2 states Maybe transitions can go in "animation state" step of json
    constructor(animationController, targetState, params) {
        params = params == null ? {} : params;

        this.hasExitTime = params.exitTime == null ? false: true;
        this.exitTime = params.exitTime == null ? 0: params.exitTime;
        this.duration = params.duration == null ? 0: params.duration;
        this.fixedDuration = params.fixedDuration == null?true:params.fixedDuration;

        this.animationController = animationController;

        //this.fromState = fromState;
        this.targetState = targetState;
        this.conditions = [];
        //transition time
    }
    
    validate(isPlaying) {
        if (this.hasExitTime === true && isPlaying === true){     //means it must finish animation before attempting validation
            return false;
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
            this.conditions.push (newCond);
    }

    createCondition(paramString, cond, value) {
        const scope = this;
        if(scope.animationController.params[paramString].constructor === SimpleTrigger){
            return function() {
                return scope.animationController.params[paramString].checkTrigger();
            }
        }
        else{
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
    constructor(animationLayer, animationAction, animationSpeed, loop, name) {
        this.animationLayer = animationLayer;
        this.animationAction = animationAction; //can be null/undefined
        this.loop = loop;

        if (this.animationAction != null && this.loop == false){
            this.animationAction.clampWhenFinished = true;
        }
        this.animationSpeed = animationSpeed;
        
        this.name = name == null ? "" : name;

        this.transitions = [];
    }
    stop() {
       
        if (this.animationAction != null){
            this.animationAction.stop();
            
        }
    }
    play() {
        if (this.animationAction != null){
            this.animationAction.reset();
            this.animationAction.play();
        }
    }
    createTransition(targetState, params) {
        const animationController = this.animationLayer.animationController;

        const transition = new AnimationTransition(animationController, targetState,params);
        this.transitions.push(transition);
        return transition;
    }

    update(){
        if (this.animationAction != null){
            if (this.animationAction.isRunning()){
                this.checkTransition(true);
            }
            else{
                this.checkTransition(false);
                if (this.loop){      // loop used this way to know when each animation did actually finished.
                    this.animationAction.reset();
                }
            }
        }
        else{
            this.checkTransition(false)
        }
    }
    checkTransition(isPlaying) {
        for (let i =0 ; i < this.transitions.length ; i++){
            if (this.transitions[i].validate(isPlaying)){
                this.animationLayer.switchToState(this.transitions[i].targetState, this.transitions[i].duration);
            }
        }
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
        this.anyEmptyState = new AnimationState(this);   //empty state
        this.anyEmptyState.name = "any"
        this.defaultState = null;  
        this.currentState = this.entryEmptyState;

    }

    update() {
        //first time playing
        if (this.played === false){
            if (this.defaultState == null && this.animationStates.length > 0)
                this.defaultState = this.animationStates[0];

            this.currentState = this.defaultState;
            this.currentState.play();
            this.played = true;
        }

        this.currentState.update();
    }
    createState(animationClip, speed, loop, name) {
        const action = this.mixer.clipAction(animationClip);
        action.loop = LoopOnce;
        const animstate = new AnimationState(this, action, speed, loop, name);
        this.animationStates.push(animstate);

        return animstate;
    }

    setInitialState(initialState){
        this.defaultState = initialState;
        this.currentState = initialState;
    }

    switchToState(targetState, duration){
        //play next animation
        targetState.play();
        //stop last animation after transition duration
        const currentState = this.currentState
        setTimeout(function() { currentState.stop() }, duration);

        const currentAction = this.currentState.animationAction;
        const targetAction = targetState.animationAction;

        if (currentAction != null && targetAction != null)
            currentAction.crossFadeTo(targetAction,duration,true);    

        this.currentState = targetState;
    }


}

class AnimationController {
    constructor(name, root, parametersArray) {

        //setup all parameters
        this.name = name == null ? "" : name;
        this.params = {};
        if (parametersArray != null){
            parametersArray.forEach(element => {
                const prop = Object.getOwnPropertyNames(element)[0];
                this.params[prop] = element[Object.keys(element)[0]];

                if (this.params[prop].constructor === Object){
                    this.params[prop] = new SimpleTrigger(this.params[prop].value);
                }
            });
        }
        
        //only 1 mixer that will control all layers/states
        this.mixer = new AnimationMixer(root);

        //Set at least a base Layer
        this.animationLayers = [];
        testing();


        const scope = this;
        function testing(){
            console.log("yay im testing!");
            document.addEventListener('keydown', callKey);
            addEventListener
        }
        function callKey(e){
            //console.log(e.code);
            if (e.code === "ArrowLeft"){
                const va = scope.getParam("movenext");
                console.log(va);
                //console.log("left!")
            }
            if (e.code === "ArrowRight"){
                scope.setParam("movenext",!scope.getParam("movenext") );
                const va = scope.getParam("movenext");
                console.log(va);
                //console.log("right!")
            }
            if (e.code === "ArrowUp"){
                scope.setTrigger("test");
                console.log("up!")
            }
            if (e.code === "ArrowDown"){
                scope.resetTrigger("test")
                console.log("down!")
            }
        }

    }

    //call this from outside
    update(clockDelta) {
        this.mixer.update(clockDelta);
        this.animationLayers.forEach(layers => {
            layers.update();
        });
    }

    createLayer(name, weight = 1, additiveBlend = false) {
        const newLayer = new AnimationLayer(this, name, weight, additiveBlend);
        this.animationLayers.push(newLayer);
        return newLayer;
    }

    setTrigger(paramName) {
        const param = this.params[paramName];
        if (param.constructor=== SimpleTrigger) {
            param.trigger = true;
        } else {
            console.error("Calling setTrigger() on non a trigger type Object.");
        }
    }
    resetTrigger(paramName){
        const param = this.params[paramName];
        if (param.constructor=== SimpleTrigger) {
            param.trigger = false;
        } else {
            console.error("Calling Trigger resetTrigger() on non a trigger type Object.");
        }
    }

    setParam(paramName, value) {
        const param = this.params[paramName];
        if (param != null) {
            if (param.constructor !== SimpleTrigger){
                this.params[paramName] = value; //check if correct
                //console.log(param); //check how to set it here
                // param = value or param.value = value
            } else {
                console.error('Calling setParam() on Trigger parameters');
            }
        } else {
            console.error('Parameter does not exist in Animation Controller');
        }
    }

    getParam(paramName) {
        const param = this.params[paramName];
        if (param != null) {
            if (param.constructor !== SimpleTrigger){
                return param;
            } else {
                console.error('Calling getParam() on Trigger parameters');
                return param.trigger;
            }
        } else {
            console.error('Parameter does not exist in Animation Layer');
        }
    }
}

class SimpleTrigger {
    constructor(startValue) {
        this.trigger = startValue === undefined ? false : startValue; //unless the user wants it to start with true, set it to false
    }

    checkTrigger() {
        if (this.trigger === true) {
            this.trigger = false;
            return true;
        }
        return false;
    }
}

export { AnimationController, AnimationLayer, AnimationState, AnimationTransition }