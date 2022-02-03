class AnimationTransition { //transitions bewtween 2 states Maybe transitions can go in "animation state" step of json
    constructor(to, param, value) {
        //
    }
}

class AnimationState {
    constructor(animationLayer) {
        //

        //speed
        //name (optional)
        //clip animationClip

    }
    addTransition(targetState) {

    }
    update() {
        //call play of animation
    }
}

class AnimationLayer { // top layer of animation
    constructor(animationStateArray, parametersArray) {
        this.currentState = new AnimationState(this);
        this.params = [];
        //this.states = [];
        this.params.push(parametersArray);

        //https://stackoverflow.com/questions/5613834/convert-string-to-variable-name-in-javascript
        //parametersArray.map((element) => { this[element] })
        this.param.forEach(element => {
            if (element == null) {
                console.log(element);
                element = new SimpleTrigger();
            }
        });
        //current state
        //any state

        //parameters
        //blend mode
        //animation states [array]
        //animation transitions
    }

    update() {
        this.currentState.update();
    }

    setTrigger(paramName) {
        const param = this.params[paramName];
        if (typeof param === 'SimpleTrigger') {
            //check if works corrects
            param.trigger = true;
        } else {
            console.error("calling a trigger on not a trigger type");
        }
    }
    newParam(paramName, value) {
        if (value == null) {
            this.params.push(new SimpleTrigger());
        } else {
            //check if works corrects
            this.params[paramName] = value;
        }
    }
    setParam(paramName, value) {
        const param = this.params[paramName];
        if (param != null) {
            if (typeof param !== 'SimpleTrigger') {
                this.params[paramName] = value; //check if correct
                //console.log(param); //check how to set it here
                // param = value or param.value = value
            } else {
                console.error('Call setTrigger() on trigger parameters');
            }
        } else {
            console.error('Parameter does not exist in Animation Layer');
        }
    }
    getParam(paramName) {
        const param = this.params[paramName];
        if (param != null) {
            if (typeof param !== 'SimpleTrigger') {
                console.log(param);
                return param;
            } else {
                console.error(param.trigger);
                return param.trigger;
            }
        } else {
            console.error('Parameter does not exist in Animation Layer');
        }
    }
}

class SimpleTrigger {
    constructor() {
        this.trigger = false;
    }

    checkTrigger() {
        if (this.trigger === true) {
            this.trigger = false;
            return true;
        }
        return false;
    }
}