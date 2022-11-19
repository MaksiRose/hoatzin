import { writeFileSync, readdirSync, readFileSync, unlinkSync } from 'fs';

interface IDObject {
	_id: string | number;
}

type Schema<T> = {
	[K in keyof T]: SchemaType<T[K]>
};

type SchemaType<T> = [T] extends [string] ? StringSchema :
	[T] extends [string | null] ? OptionalStringSchema :
	[T] extends [number] ? NumberSchema :
	[T] extends [number | null] ? OptionalNumberSchema :
	[T] extends [string | number] ? StringNumberSchema :
	[T] extends [boolean] ? BooleanSchema :
	[T] extends [Array<infer U>] ? ArraySchema<SchemaType<U>> :
	Record<string, never> extends Required<T> ? MapSchema<T extends Record<string, infer U> ? U : never> :
	[T] extends [{ [key in string]: any }] ? ObjectSchema<Schema<T>> :
	never;

interface StringSchema {
	type: 'string',
	default: string,
	locked?: boolean;
}

interface OptionalStringSchema {
	type: 'string?',
	default: string | null,
	locked?: boolean;
}

interface NumberSchema {
	type: 'number',
	default: number,
	locked?: boolean;
}

interface OptionalNumberSchema {
	type: 'number?',
	default: number | null,
	locked?: boolean;
}

interface StringNumberSchema {
	type: 'string|number',
	default: string | number,
	locked?: boolean;
}

interface BooleanSchema {
	type: 'boolean',
	default: boolean,
	locked?: boolean;
}

interface ArraySchema<T> {
	type: 'array',
	of: T,
}

interface MapSchema<T> {
	type: 'map',
	of: SchemaType<T>;
}

interface ObjectSchema<T> {
	type: 'object',
	default: T;
}

type LogSettings = {
	createFile: boolean,
	deleteFile: boolean,
	changeFile: boolean;
};

type PrimitiveSchema = StringSchema | OptionalStringSchema | NumberSchema | OptionalNumberSchema | StringNumberSchema | BooleanSchema;
type AnySchema = PrimitiveSchema | ArraySchema<any> | MapSchema<any> | ObjectSchema<any>;

export class Model<T extends IDObject> {

	path: string;
	schema: Schema<T>;
	find: (filter?: (value: T) => boolean) => Array<T>;
	findOne: (filter: (value: T) => boolean) => T;
	create: (dataObject: T, options?: { log?: boolean; }) => T;
	findOneAndDelete: (filter: (value: T) => boolean, options?: { log?: boolean; }) => void;
	findOneAndUpdate: (filter: (value: T) => boolean, updateFunction: (value: T) => void, options?: { log?: boolean; }) => T;

	/**
	 * 
	 * @param path The path of the folder where the database files are stored, relative to the project root.
	 * @param schema The schema of the database
	 * @param createLog 
	 * @param isStrict 
	 */
	constructor(path: string, schema: Schema<T>, createLog?: boolean | Partial<LogSettings>, isStrict?: boolean) {

		this.path = path;
		this.schema = schema;
		const log: LogSettings = {
			createFile: (typeof createLog === 'boolean' ? createLog : createLog?.createFile) ?? false,
			deleteFile: (typeof createLog === 'boolean' ? createLog : createLog?.deleteFile) ?? false,
			changeFile: (typeof createLog === 'boolean' ? createLog : createLog?.changeFile) ?? false,
		};
		const strict: boolean = isStrict ?? true;

		/** Cleans up the information of a file to be accurate to the schema. */
		function cleanUp(updateObject: T): T {

			/* Add / Update existing keys */
			for (const [key, value] of Object.entries(schema)) {

				updateObject = checkTypeMatching(updateObject, key as keyof typeof schema, value);
			}

			/* Get rid of keys that aren't in schema */
			for (const key of Object.keys(updateObject) as Array<keyof typeof updateObject>) {

				const keys = Object.keys(schema);
				if (!keys.includes(String(key))) { delete updateObject[key]; }
			}

			return updateObject;
		}

		/** Overwrites a file in the database. **Caution:** This could make unexpected changes to the file! */
		function save(updateObject: T): void {

			let dataObject = JSON.parse(JSON.stringify(updateObject)) as T;
			dataObject = cleanUp(dataObject);

			if (strict === true && JSON.stringify(updateObject) !== JSON.stringify(dataObject)) {

				console.trace(`Object inconsistency, received: ${JSON.stringify(updateObject)} but needed: ${JSON.stringify(dataObject)}`);
				throw new TypeError('Type of received object is not assignable to type of database.');
			}

			writeFileSync(`${path}/${updateObject._id}.json`, JSON.stringify(updateObject, null, '\t'));
		};

		/** Searches for all objects that meet the filter, and returns an array of them. */
		this.find = (filter?: (value: T) => boolean): Array<T> => {

			const allFileNames = readdirSync(path).filter(f => f.endsWith('.json'));
			const returnedFiles: T[] = [];

			for (const fileName of allFileNames) {

				returnedFiles.push(cleanUp(JSON.parse(readFileSync(`${path}/${fileName}`, 'utf-8')) as T));
			}
			return returnedFiles
				.filter(file => {
					if (typeof filter === 'function') { return filter(file); }
					return true;
				});
		};

		/** Searches for an object that meets the filter, and returns it. If several objects meet the requirement, the first that is found is returned. */
		this.findOne = (filter: (value: T) => boolean): T => {

			const allFileNames = readdirSync(path).filter(f => f.endsWith('.json'));

			for (const fileName of allFileNames) {

				const file = cleanUp(JSON.parse(readFileSync(`${path}/${fileName}`, 'utf-8')) as T);
				if (typeof filter === 'function' && filter(file)) { return file; }
			}

			throw new Error('Could not find a document with the given filter.');
		};

		/** Creates a new database entry. */
		this.create = (
			dataObject: T,
			options: { log?: boolean; } = {},
		): T => {

			save(dataObject);

			if (options.log === undefined ? log.createFile : options.log) { console.log('Created File: ', dataObject._id); }
			return dataObject;
		};

		/** Searches for an object that meets the filter, and deletes it. If several objects meet the requirement, the first that is found is deleted. */
		this.findOneAndDelete = (
			filter: (value: T) => boolean,
			options: { log?: boolean; } = {},
		): void => {

			const dataObject = this.findOne(filter);

			unlinkSync(`${path}/${dataObject._id}.json`);

			if (options.log === undefined ? log.deleteFile : options.log) { console.log('Deleted File: ', dataObject._id); }
			return;
		};

		/** Searches for an object that meets the filter, and updates it. If several objects meet the requirement, the first that is found is updated. */
		this.findOneAndUpdate = (
			filter: (value: T) => boolean,
			updateFunction: (value: T) => void,
			options: { log?: boolean; } = {},
		): T => {

			const dataObject = this.findOne(filter);
			const newDataObject = JSON.parse(JSON.stringify(dataObject)) as T;
			updateFunction(newDataObject);


			let updateObject = JSON.parse(JSON.stringify(newDataObject)) as T;
			for (const [key, value] of Object.entries(schema)) {

				updateObject = changeLockedBack(updateObject, newDataObject, key as keyof typeof schema, value);
			}
			if (JSON.stringify(updateObject) !== JSON.stringify(newDataObject)) { throw new Error('A locked property has been changed'); }


			save(newDataObject);

			if (options.log === undefined ? log.changeFile : options.log) { createLog(createLogArray(dataObject, newDataObject, '')); }

			return newDataObject;


			function isObject(val: any): val is Record<string | number | symbol, unknown> { return typeof val === 'object' && val !== null; }
			type LogArray = Array<{ path: string, oldValue: string, newValue: string; }>;
			/** It takes two objects, compares them, and logs the differences */
			function createLogArray<Type extends Record<PropertyKey, any>>(oldObject: Type, newObject: Type, variablePath: string): LogArray {

				let allPaths: LogArray = [];

				for (const key of Object.keys(Object.keys(newObject).length === 0 && Object.keys(oldObject).length > 0 ? oldObject : newObject)) {

					const hasObjectsAsValues = (
						val: any,
					) => Object.values(val).filter(v => isObject(v)).length > 0;

					const objectKeyOrUndefined = (
						val: any,
						key: string,
					) => isObject(val) ? val?.[key] : undefined;

					if (isObject(newObject) && isObject(newObject?.[key]) && (hasObjectsAsValues(newObject?.[key]) || (isObject(oldObject) && isObject(oldObject?.[key]) && hasObjectsAsValues(oldObject?.[key])))) {

						allPaths = allPaths.concat(createLogArray(objectKeyOrUndefined(oldObject, key), newObject?.[key], variablePath + `.${key}`));
					}
					else if (formatLog(objectKeyOrUndefined(oldObject, key), objectKeyOrUndefined(newObject, key)) != formatLog(objectKeyOrUndefined(newObject, key), objectKeyOrUndefined(oldObject, key))) {

						allPaths.push({ path: `${variablePath}.${key}`, oldValue: formatLog(objectKeyOrUndefined(oldObject, key), objectKeyOrUndefined(newObject, key)), newValue: formatLog(objectKeyOrUndefined(newObject, key), objectKeyOrUndefined(oldObject, key)) });
					}
				}
				return allPaths;
			}

			/** Formats a variable to be readable for the log output. */
			function formatLog<Type>(main: Type, other: Type): string {

				if (!isObjectOrArray(main)) {

					return `${main}`;
				}

				if (Array.isArray(main)) {

					return `[${main.join(', ')}]`;
				}

				let result = JSON.stringify(objectReducer(main, other), null, 1);
				result = result.replace(/^ +/gm, ' ');
				result = result.replace(/\n/g, '');
				result = result.replace(/"/g, '');
				result = result.replace(/{ /g, '{').replace(/ }/g, '}');
				result = result.replace(/\[ /g, '[').replace(/ \]/g, ']');
				return result;

				function isObjectOrArray(obj: any): obj is Record<string | number | symbol, unknown> | Array<unknown> { return obj === Object(obj); }

				function objectReducer<Type1 extends Record<string | number | symbol, unknown>>(mainObject: Type1, otherObject: unknown): Type1 {

					let newObject = {} as Type1;

					for (const key of Object.keys(mainObject) as Array<keyof Type1>) {

						const mainObjKey = mainObject[key];
						if (!isObject(mainObjKey)) {

							if (!isObject(otherObject) || mainObjKey != otherObject?.[key]) { newObject[key] = mainObjKey; }

							continue;
						}
						else {

							newObject = { ...newObject, ...objectReducer(mainObjKey, isObject(otherObject) ? otherObject?.[key] : undefined) };
						}
					}

					return newObject;
				}
			}

			function createLog(logArray: LogArray): void {

				for (const { path, oldValue, newValue } of logArray) {

					console.log(`\x1b[32m${dataObject?._id}\x1b[0m${path} changed from \x1b[33m${oldValue} \x1b[0mto \x1b[33m${newValue} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				}
			}
		};


		/* Update every object in the path to be in line with the schema when the class is called */
		for (let dataObject of this.find()) {

			save(cleanUp(dataObject));
		}
	}
}

function isPrimitiveSchema(schema: AnySchema): schema is PrimitiveSchema {
	return [
		'string',
		'string?',
		'number',
		'number?',
		'string|number',
		'boolean',
	].includes(schema.type);
}

function primitiveTypeDoesNotMatch(value: PrimitiveSchema, valToCheck: any): boolean {
	const isNotString = value.type === 'string' && typeof valToCheck !== 'string';
	const isNotStringOrNull = value.type === 'string?' && valToCheck !== null && typeof valToCheck !== 'string';
	const isNotNumber = value.type === 'number' && typeof valToCheck !== 'number';
	const isNotNumberOrNull = value.type === 'number?' && valToCheck !== null && typeof valToCheck !== 'number';
	const isNotStringOrNumber = value.type === 'string|number' && typeof valToCheck !== 'string' && typeof valToCheck !== 'number';
	const isNotBoolean = value.type === 'boolean' && typeof valToCheck !== 'boolean';
	return isNotString || isNotStringOrNull || isNotNumber || isNotNumberOrNull || isNotStringOrNumber || isNotBoolean;
}

function checkTypeMatching<
	T extends Record<string | number | symbol, any> | Array<any>
>(
	obj: T,
	key: keyof typeof obj,
	value: Schema<T>[any]
): T;
function checkTypeMatching(
	obj: Record<string | number | symbol, any> | Array<any>,
	key: any,
	value: AnySchema,
): Record<string | number | symbol, any> | Array<any> {

	// Add key if object doesn't have it
	if (!Array.isArray(obj) && !Object.hasOwn(obj, key)) {

		if (value.type === 'array') { obj[key] = []; }
		else if (value.type === 'map' || value.type === 'object') { obj[key] = {}; }
		else { obj[key] = value.default; }
	}

	// Change value to default value if value type is primitive and doesn't match
	if (isPrimitiveSchema(value) && primitiveTypeDoesNotMatch(value, obj[key])) { obj[key] = value.default; }
	// Change value if value type is array
	else if (value.type === 'array') {

		// Change value if value is array
		const arr = obj[key];
		if (Array.isArray(arr)) {

			for (let k = 0; k < arr.length; k++) {

				obj[key] = checkTypeMatching(obj[key], k, value.of);
			}
		}
		// Change value to array if value isn't
		else { obj[key] = []; }
	}
	else if (value.type === 'map') {

		// Change value to object if value isn't
		if (obj[key] !== Object(obj[key]) || Array.isArray(obj[key])) { obj[key] = {}; }
		// Change value if value is object
		else {

			for (const k of Object.keys(obj[key])) {

				obj[key] = checkTypeMatching(obj[key], k, value.of);
			}
		}
	}
	else if (value.type === 'object') {

		// Change value to object if value isn't
		if (obj[key] !== Object(obj[key]) && !Array.isArray(obj[key])) { obj[key] = {}; }

		/* Add / Update existing keys */
		for (const [k, v] of Object.entries(value.default)) {

			obj[key] = checkTypeMatching((obj[key]), k, v as any);
		}

		/* Get rid of keys that aren't in schema */
		const keys = Object.keys(value.default);
		for (const k of Object.keys(obj[key])) {

			if (!keys.includes(k)) { delete obj[key][k]; }
		}
	}

	return obj;
}


function changeLockedBack<
	T extends Record<string | number | symbol, any> | Array<any>
>(
	obj1: T,
	obj2: T,
	key: keyof typeof obj1,
	value: Schema<T>[any]
): T;
function changeLockedBack(
	obj1: Record<string | number | symbol, any> | Array<any>,
	obj2: Record<string | number | symbol, any> | Array<any>,
	key: any,
	value: AnySchema,
): Record<string | number | symbol, any> | Array<any> {

	if (isPrimitiveSchema(value) && value.locked === true && obj2[key] !== obj1[key]) {

		obj2[key] = obj1[key];
	}
	else if (value.type === 'array') {

		for (let k = 0; k < (Array.isArray(obj2[key]) ? obj2[key] : Array.isArray(obj1[key]) ? obj1[key] : []).length; k++) {

			obj2[key] = changeLockedBack(obj1[key], obj2[key], k, value.of);
		}
	}
	else if (value.type === 'map') {

		const obj1keys = Object.keys(obj1[key]);
		const obj2keys = Object.keys(obj2[key]);
		for (const k of obj1keys.length > 0 ? obj1keys : obj2keys) {

			obj2[key] = changeLockedBack(obj1[key], obj2[key], k, value.of);
		}
	}
	else if (value.type === 'object') {

		for (const [k, v] of Object.entries(value.default)) {

			obj2[key] = changeLockedBack(obj1[key], obj2[key], k, v as any);
		}
	}

	return obj2;
}