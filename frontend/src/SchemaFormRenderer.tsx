import React from 'react';
// Removed unused z import: import { ZodTypeAny, ZodObject, ZodArray, ZodString, ZodDefault, z } from 'zod';
import { ZodTypeAny, ZodObject, ZodArray, ZodString, ZodDefault } from 'zod'; // Keep necessary imports
import { ComplianceData } from './schema';

interface SchemaFormRendererProps {
    schema: ZodTypeAny; // Accept any Zod type for recursion
    data: unknown; // Use unknown for data passed down during recursion
    onDataChange: (newData: ComplianceData) => void; // Top-level change handler
    path?: (string | number)[]; // Path can include numbers for array indices
    fullData: ComplianceData; // Pass the full original data down for updates
}

// Helper to get the underlying type if it's wrapped (e.g., ZodDefault)
function getBaseType(schema: ZodTypeAny): ZodTypeAny {
    if (schema instanceof ZodDefault) {
        return getBaseType(schema._def.innerType);
    }
    // Add other wrappers like ZodOptional if needed
    return schema;
}

// Helper to generate a default value based on schema type (basic version)
function generateDefaultValue(schema: ZodTypeAny): unknown { // Return unknown
    const baseType = getBaseType(schema);
    if (baseType instanceof ZodString) return '';
    if (baseType instanceof ZodArray) return [];
    if (baseType instanceof ZodObject) {
        // Recursively generate defaults for object properties
        const shape = baseType.shape;
        const defaultObject: Record<string, unknown> = {}; // Use Record<string, unknown>
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
    data, // This 'data' now refers to the specific part of the structure being rendered
    onDataChange,
    path = [],
    fullData, // Use fullData for making immutable updates
}) => {

    // Helper function to handle data updates immutably using the full data object
    const handleValueChange = (
        currentPath: (string | number)[],
        value: unknown // Use unknown
    ) => {
        const newData = JSON.parse(JSON.stringify(fullData)); // Deep copy the original full data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentLevel: any = newData; // Use any here for dynamic navigation, checked below

        // Navigate to the parent of the target element
        for (let i = 0; i < currentPath.length - 1; i++) {
            const key = currentPath[i];
            if (typeof currentLevel !== 'object' || currentLevel === null) {
                console.error("Error navigating path in handleValueChange", currentPath, key);
                return; // Stop if path is invalid
            }
             // Ensure nested objects/arrays exist
             if (currentLevel[key] === undefined || currentLevel[key] === null) {
                 const nextKeyIsIndex = typeof currentPath[i+1] === 'number';
                 currentLevel[key] = nextKeyIsIndex ? [] : {};
             }
            currentLevel = currentLevel[key];
        }

         // Ensure the parent level is an object or array before setting the value
         if (typeof currentLevel !== 'object' || currentLevel === null) {
             console.error("Error finding parent level in handleValueChange", currentPath);
             return;
         }

        // Set the value at the final key/index
        const finalKey = currentPath[currentPath.length - 1];
        currentLevel[finalKey] = value;
        onDataChange(newData); // Trigger update with the modified full data structure
    };

    const baseSchema = getBaseType(schema);

    // --- Render Logic for Objects ---
    if (baseSchema instanceof ZodObject) {
        const shape = baseSchema.shape;
        // Ensure data is an object before trying to access keys
        const objectData = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data : {};

        return (
            <div className={`space-y-4 ${path.length > 0 ? 'pl-4 border-l border-gray-200' : 'p-4'}`}>
                {Object.keys(shape).map((key) => {
                    const fieldSchema = shape[key];
                    const currentPath = [...path, key];
                    const fieldData = (objectData as Record<string, unknown>)?.[key]; // Access data safely
                    const description = fieldSchema.description || key;

                    return (
                        <div key={currentPath.join('.')} className="mb-3">
                             {!(getBaseType(fieldSchema) instanceof ZodArray) && (
                                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                                    {description}
                                </label>
                             )}
                            <SchemaFormRenderer
                                schema={fieldSchema}
                                data={fieldData} // Pass down the specific part of the data
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
        const elementType = baseSchema.element;
        const arrayData = Array.isArray(data) ? data : [];
        const description = schema.description || 'Items';

        return (
            <div className="mb-3 p-3 border rounded-md bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                    {description}
                </label>
                {arrayData.map((item, index) => (
                    <div key={index} className="flex items-start mb-3 p-2 border rounded bg-white shadow-sm">
                        <div className="flex-grow">
                             <SchemaFormRenderer
                                schema={elementType} // Pass the schema for the element type
                                data={item} // Pass the specific item data
                                onDataChange={onDataChange}
                                path={[...path, index]} // Path includes the array index
                                fullData={fullData}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const newArray = arrayData.filter((_, i) => i !== index);
                                handleValueChange(path, newArray); // Update the array at the current path
                            }}
                            className="ml-2 mt-1 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs self-start"
                        >
                            Remove
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        const newItem = generateDefaultValue(elementType); // Generate default based on element schema
                        const newArray = [...arrayData, newItem];
                        handleValueChange(path, newArray); // Update the array at the current path
                    }}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                    Add {elementType.description || 'Item'}
                </button>
            </div>
        );
    }

    // --- Render Logic for Primitives (String) ---
    if (baseSchema instanceof ZodString) {
        return (
            <textarea
                id={path.join('.')}
                value={String(data ?? '')} // Ensure value is a string
                onChange={(e) => handleValueChange(path, e.target.value)}
                rows={3}
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
