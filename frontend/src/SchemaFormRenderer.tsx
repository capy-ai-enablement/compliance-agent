import React from 'react';
import { ZodTypeAny, ZodObject, ZodArray, ZodString, ZodNumber, ZodDefault, ZodLazy } from 'zod'; // Added ZodNumber and ZodLazy
// Import the type from the backend schema file
import type { ComplianceData } from '../../backend/src/schemas';

interface SchemaFormRendererProps {
    schema: ZodTypeAny; // Accept any Zod type for recursion
    data: unknown; // Use unknown for data passed down during recursion
    onDataChange: (newData: ComplianceData) => void; // Top-level change handler
    path?: (string | number)[]; // Path can include numbers for array indices
    fullData: ComplianceData; // Pass the full original data down for updates
}

// Removed duplicated import line

// Helper to get the underlying type if it's wrapped (e.g., ZodDefault, ZodLazy)
function getBaseType(schema: ZodTypeAny): ZodTypeAny {
    if (schema instanceof ZodDefault) {
        return getBaseType(schema._def.innerType);
    }
    if (schema instanceof ZodLazy) {
        // Unwrap ZodLazy to get the actual schema definition
        return getBaseType(schema.schema);
    }
    // Add other wrappers like ZodOptional if needed
    return schema;
}

// Helper to generate a default value based on schema type (basic version)
function generateDefaultValue(schema: ZodTypeAny): unknown {
    const baseType = getBaseType(schema);
    if (baseType instanceof ZodString) return '';
    if (baseType instanceof ZodNumber) {
        // Default to min value if available, otherwise 0 or undefined? Let's use 1 for CIA.
        const minCheck = baseType._def.checks.find(check => check.kind === 'min');
        return minCheck ? minCheck.value : 1; // Default to 1 for CIA ratings
    }
    if (baseType instanceof ZodArray) return [];
    if (baseType instanceof ZodObject) {
        // Recursively generate defaults for object properties
        const shape = baseType.shape;
        const defaultObject: Record<string, unknown> = {};
        Object.keys(shape).forEach(key => {
            defaultObject[key] = generateDefaultValue(shape[key]);
        });
        return defaultObject;
    }
    // Add other types like ZodBoolean, ZodNumber etc. if needed
    return undefined; // Default for unhandled types
}


const SchemaFormRenderer: React.FC<SchemaFormRendererProps> = ({
    schema,
    data,
    onDataChange,
    path = [],
    fullData,
}) => {

    // --- Determine the Schema to Render ---
    // If path has length 1, it's the initial call from App.tsx. Navigate the main schema.
    // Otherwise, it's a recursive call, and the 'schema' prop is already the correct sub-schema.
    let schemaToRender: ZodTypeAny;
    if (path && path.length === 1) {
        const initialSegment = path[0];
        const baseSchema = getBaseType(schema); // Use the original schema passed from App
         if (baseSchema instanceof ZodObject && typeof initialSegment === 'string') {
             schemaToRender = baseSchema.shape[initialSegment];
         } else {
             // This case shouldn't happen based on App.tsx usage, but handle defensively
             console.error("Invalid initial path segment for schema navigation:", path, initialSegment);
             return <div className="text-red-500 text-sm">Error: Invalid initial path.</div>;
         }
         if (!schemaToRender) {
              console.error("Schema not found for initial path segment:", path, initialSegment);
              return <div className="text-red-500 text-sm">Error: Schema not found for initial path.</div>;
         }
    } else {
        // For recursive calls (path.length === 0 or path.length > 1),
        // the schema prop is already the correct sub-schema passed down.
        schemaToRender = schema;
    }
    // --- End Schema Determination ---


    // Helper function to handle data updates immutably using the full data object
    const handleValueChange = (
        currentPath: (string | number)[],
        value: unknown
    ) => {
        const newData = JSON.parse(JSON.stringify(fullData)); // Deep copy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parentLevel: any = newData; // Use 'any' for dynamic navigation

        // Navigate to the parent object/array
        for (let i = 0; i < currentPath.length - 1; i++) {
            const key = currentPath[i];
            if (typeof parentLevel !== 'object' || parentLevel === null) {
                console.error("Error navigating path in handleValueChange", currentPath, key);
                return;
            }
             // Ensure nested objects/arrays exist before navigating deeper
             if (parentLevel[key] === undefined || parentLevel[key] === null) {
                 const nextKeyIsIndex = typeof currentPath[i+1] === 'number';
                 parentLevel[key] = nextKeyIsIndex ? [] : {}; // Create array or object if needed
             }
            parentLevel = parentLevel[key];
        }

         // Ensure the parent level is an object or array before setting the value
         if (typeof parentLevel !== 'object' || parentLevel === null) {
             console.error("Error finding parent level in handleValueChange", currentPath);
             return;
         }

        // Set the value at the final key/index in the parent
        const finalKeyOrIndex = currentPath[currentPath.length - 1];
        parentLevel[finalKeyOrIndex] = value;

        onDataChange(newData); // Trigger update with the modified full data structure
    };

    // Use the determined schemaToRender from here on
    const baseSchema = getBaseType(schemaToRender);

    // --- Render Logic for Objects ---
    if (baseSchema instanceof ZodObject) {
        const shape = baseSchema.shape;
        const objectData = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data : {};

        // Check if the current path points to a 'cia' object within 'dataPoints'
        const isCiaObject = path.length >= 2 && path[path.length - 1] === 'cia' && path[path.length - 3] === 'dataPoints';

        // Apply flex row styling specifically for the CIA object
        const containerClasses = isCiaObject
            ? `flex flex-row gap-4 items-start ${path.length > 0 ? 'ml-1' : 'p-4'}` // Horizontal layout for CIA
            : `space-y-4 ${path.length > 0 ? 'pl-4 border-l border-gray-200 ml-1' : 'p-4'}`; // Default vertical layout

        return (
            <div className={containerClasses}>
                {Object.keys(shape).map((key) => {
                    const fieldSchema = shape[key];
                    const currentPath = [...path, key];
                    const fieldData = (objectData as Record<string, unknown>)?.[key];
                    // Removed duplicate fieldData declaration
                    const description = fieldSchema.description || key;

                    // Adjust layout for individual fields within the CIA object
                    const fieldContainerClasses = isCiaObject ? "flex-1" : "mb-3"; // Use flex-1 for CIA fields, mb-3 otherwise

                    return (
                        <div key={currentPath.join('.')} className={fieldContainerClasses}>
                             {/* Render label only if not rendering an array directly */}
                             {!(getBaseType(fieldSchema) instanceof ZodArray) && (
                                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                                    {description}
                                </label>
                             )}
                            <SchemaFormRenderer
                                schema={fieldSchema} // Pass the specific field schema for recursion
                                data={fieldData}
                                onDataChange={onDataChange}
                                path={currentPath}
                                fullData={fullData}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    // --- Render Logic for Arrays ---
    if (baseSchema instanceof ZodArray) {
        const elementType = baseSchema.element; // Correct element type from the navigated schema
        const arrayData = Array.isArray(data) ? data : [];
        const description = schemaToRender.description || 'Items'; // Use description from the correct schema

        return (
            <div className="mb-3 p-3 border rounded-md bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize font-semibold"> {/* Made label bold */}
                    {description}
                </label>
                {arrayData.length === 0 && <p className="text-xs text-gray-500 italic mb-2">No items yet.</p>}
                {arrayData.map((item, index) => (
                    <div key={index} className="flex items-start mb-3 p-2 border rounded bg-white shadow-sm">
                        <div className="flex-grow">
                             <SchemaFormRenderer
                                schema={elementType} // Pass the array element schema for recursion
                                data={item}
                                onDataChange={onDataChange}
                                path={[...path, index]}
                                fullData={fullData}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const newArray = arrayData.filter((_, i) => i !== index);
                                handleValueChange(path, newArray);
                            }}
                            className="ml-2 mt-1 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs self-start flex-shrink-0" // Added flex-shrink-0
                        >
                            Remove
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        const newItem = generateDefaultValue(elementType);
                        const newArray = [...arrayData, newItem];
                        handleValueChange(path, newArray);
                    }}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                    Add {elementType.description || 'Item'}
                </button>
            </div>
        );
    }

    // --- Render Logic for Primitives (String, Number) ---
    if (baseSchema instanceof ZodString) {
        return (
            <textarea
                // Removed id={path.join('.')} as label uses className now
                value={String(data ?? '')}
                onChange={(e) => handleValueChange(path, e.target.value)}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
        );
    }

    if (baseSchema instanceof ZodNumber) {
        // Extract min/max constraints if they exist in the schema definition
        const minCheck = baseSchema._def.checks.find(check => check.kind === 'min');
        const maxCheck = baseSchema._def.checks.find(check => check.kind === 'max');
        const minValue = minCheck ? minCheck.value : undefined;
        const maxValue = maxCheck ? maxCheck.value : undefined;

        return (
            <input
                type="number"
                value={String(data ?? (minValue ?? ''))} // Default to min value if data is null/undefined
                onChange={(e) => {
                    const numValue = e.target.value === '' ? minValue ?? null : parseInt(e.target.value, 10); // Default to min or null if empty
                    // Only update if it's a valid number or null (if allowed, though our schema requires a number)
                    if (numValue !== null && !isNaN(numValue)) {
                         handleValueChange(path, numValue);
                    } else if (minValue !== undefined) {
                        // If cleared or invalid, reset to minimum if defined
                        handleValueChange(path, minValue);
                    }
                    // If no min value and invalid, maybe do nothing or handle differently?
                    // For CIA, resetting to 1 (min) seems reasonable.
                }}
                min={minValue}
                max={maxValue}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
        );
    }


    // --- Fallback for Unsupported Types ---
    return (
        <div className="text-gray-500 text-sm">
            Unsupported field type at path: {path.join('.')} ({baseSchema._def.typeName})
        </div>
    );
};

export default SchemaFormRenderer;
