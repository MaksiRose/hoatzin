import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

interface IDObject {
	_id: string;
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
	locked: boolean;
}

interface OptionalStringSchema {
	type: 'string?',
	default: string | null,
	locked: boolean;
}

interface NumberSchema {
	type: 'number',
	default: number,
	locked: boolean;
}

interface OptionalNumberSchema {
	type: 'number?',
	default: number | null,
	locked: boolean;
}

interface StringNumberSchema {
	type: 'string|number',
	default: string | number,
	locked: boolean;
}

interface BooleanSchema {
	type: 'boolean',
	default: boolean,
	locked: boolean;
}

interface ArraySchema<T> {
	type: 'array',
	of: T,
	locked: boolean;
}

interface MapSchema<T> {
	type: 'map',
	of: SchemaType<T>;
	locked: boolean;
}

interface ObjectSchema<T> {
	type: 'object',
	default: T;
	locked: boolean;
}

type LogSettings = {
		createFile: boolean,
		deleteFile: boolean,
		changeFile: boolean
	}

type PrimitiveSchema = StringSchema | OptionalStringSchema | NumberSchema | OptionalNumberSchema | StringNumberSchema | BooleanSchema;
type AnySchema = PrimitiveSchema | ArraySchema<any> | MapSchema<any> | ObjectSchema<any>;

export class Model<T extends IDObject> {

	path: string;
	schema: Schema<T>;
	save: (updateObject: T) => Promise<void>;
	find: (filter?: (value: T) => boolean) => Promise<Array<T>>;
	findOne: (filter: (value: T) => boolean) => Promise<T>;
	create: (dataObject: T) => Promise<T>;
	findOneAndDelete: (filter: (value: T) => boolean) => Promise<void>;
	findOneAndUpdate: (filter: (value: T) => boolean, updateFunction: (value: T) => void) => Promise<T>;
	update: (uuid: string) => Promise<T>;

	constructor(path: string, schema: Schema<T>, createLog?: boolean | Partial<LogSettings>) {

		this.path = path;
		this.schema = schema;
		const log: LogSettings = {
			createFile: (typeof createLog === 'boolean' ? createLog : createLog?.createFile) ?? false,
			deleteFile: (typeof createLog === 'boolean' ? createLog : createLog?.deleteFile) ?? false,
			changeFile: (typeof createLog === 'boolean' ? createLog : createLog?.changeFile) ?? false,
		}

		/** Overwrites a file in the database. **Caution:** This could make unexpected changes to the file! */
		this.save = async (updateObject: T): Promise<void> => {

			let dataObject = JSON.parse(JSON.stringify(updateObject)) as T;

			/* Add / Update existing keys */
			for (const [key, value] of Object.entries(schema)) {

				dataObject = checkTypeMatching(dataObject, key as keyof typeof schema, value);
			}

			/* Get rid of keys that aren't in schema */
			for (const key of Object.keys(dataObject) as Array<keyof typeof dataObject>) {

				const keys = Object.keys(schema);
				if (!keys.includes(String(key))) { delete dataObject[key]; }
			}

			if (JSON.stringify(updateObject) !== JSON.stringify(dataObject)) {

				console.trace(`Object inconsistency, received: ${JSON.stringify(updateObject)} but needed: ${JSON.stringify(dataObject)}`);
				throw new TypeError('Type of received object is not assignable to type of database.');
			}

			writeFileSync(`${path}/${updateObject._id}.json`, JSON.stringify(updateObject, null, '\t'));
		};

		/** Searches for all objects that meet the filter, and returns an array of them. */
		this.find = async (filter?: (value: T) => boolean): Promise<Array<T>> => {

			const allDocumentNames = readdirSync(path).filter(f => f.endsWith('.json'));
			return allDocumentNames
				.map(documentName => {
					return JSON.parse(readFileSync(`${path}/${documentName}`, 'utf-8')) as T;
				})
				.filter(v => {
					if (typeof filter === 'function') { return filter(v); }
					return true;
				});
		};

		/** Searches for an object that meets the filter, and returns it. If several objects meet the requirement, the first that is found is returned. */
		this.findOne = async (filter: (value: T) => boolean): Promise<T> => {

			const foundDocuments = await this.find(filter);
			const returnDocument = foundDocuments[0];
			if (returnDocument) { return returnDocument; }

			throw new Error('Could not find a document with the given filter.');
		};

		/** Creates a new database entry. */
		this.create = async (dataObject: T): Promise<T> => {

			this.save(dataObject);

			if (log.createFile) { console.log('Created File: ', dataObject._id); }
			return dataObject;
		};

		/** Searches for an object that meets the filter, and deletes it. If several objects meet the requirement, the first that is found is deleted. */
		this.findOneAndDelete = async (filter: (value: T) => boolean): Promise<void> => {

			const dataObject = await this.findOne(filter);

			unlinkSync(`${path}/${dataObject._id}.json`);

			if (log.deleteFile) { console.log('Deleted File: ', dataObject._id); }

			return;
		};

		/** Searches for an object that meets the filter, and updates it. If several objects meet the requirement, the first that is found is updated. */
		this.findOneAndUpdate = async (filter: (value: T) => boolean, updateFunction: (value: T) => void): Promise<T> => {

			const dataObject = await this.findOne(filter);
			const newDataObject = JSON.parse(JSON.stringify(dataObject)) as T;
			updateFunction(newDataObject);

			createLog(createLogArray(dataObject, newDataObject, ''));

			await this.save(newDataObject);

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

					if (log.changeFile) { console.log(`\x1b[32m${dataObject?._id}\x1b[0m${path} changed from \x1b[33m${oldValue} \x1b[0mto \x1b[33m${newValue} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`); }
				}
			}
		};


		/** Updates the information of a file to be accurate to the schema. Automatically done when the model is defined. */
		this.update = async (uuid: string): Promise<T> => {

			let dataObject = await this.findOne(v => v._id === uuid); // Technically unsafe, due to literal-string uuid types... but unrealistic

			/* Add / Update existing keys */
			for (const [key, value] of Object.entries(schema)) {

				dataObject = checkTypeMatching(dataObject, key as keyof typeof schema, value);
			}

			/* Get rid of keys that aren't in schema */
			for (const key of Object.keys(dataObject) as Array<keyof typeof dataObject>) {

				const keys = Object.keys(schema);
				if (!keys.includes(String(key))) { delete dataObject[key]; }
			}

			await this.save(dataObject);

			return dataObject;
		};
		for (const file of readdirSync(path).filter(f => f.endsWith('.json'))) {

			this.update(file.replace('.json', ''));
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