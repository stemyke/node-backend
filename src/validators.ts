import {ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface} from "class-validator";
import {ObjectId} from "bson";

function checkValue(multi: boolean, value: any): boolean {
    if (multi) {
        return Array.isArray(value) && value.every(v => {
            try {
                const id = new ObjectId(v);
                return id instanceof ObjectId;
            } catch (e) {
                return false;
            }
        });
    }
    if (null === value) return true;
    try {
        const id = new ObjectId(value);
        return id instanceof ObjectId;
    } catch (e) {
        return false;
    }
}

@ValidatorConstraint()
export class IsFile implements ValidatorConstraintInterface {
    validate(value: any, validationArguments: ValidationArguments) {
        const [multi] = (validationArguments.constraints || []);
        return checkValue(multi, value);
    }
}

@ValidatorConstraint()
export class IsObjectId implements ValidatorConstraintInterface {
    validate(value: any, validationArguments: ValidationArguments) {
        const [_, multi] = (validationArguments.constraints || []);
        return checkValue(multi, value);
    }
}
