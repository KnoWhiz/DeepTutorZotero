import React, { useState } from 'react';

const buttonStyle = {
  background: '#2c25ac',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 600,
  padding: '4px 8px',
  fontSize: '11px',
  cursor: 'pointer',
  minWidth: 0,
  minHeight: 0,
};

const fileButtonStyle = {
  background: '#f8f9fa',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  padding: '4px 8px',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  margin: '2px 0',
  display: 'flex',
};

const removeButtonStyle = {
  color: '#dc3545',
  fontWeight: 'bold',
  fontSize: '16px',
  cursor: 'pointer',
  padding: '0 4px',
  background: 'none',
  border: 'none',
};

const modelTypeButtonBase = {
  flex: 1,
  padding: '6px 0',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 600,
  fontSize: '1em',
  cursor: 'pointer',
  background: '#e0e0e0',
  color: '#444',
};

const selectedModelTypeButton = {
  background: '#2c25ac',
  color: '#fff',
};

function ModelSelection({ onSubmit }) {
  const [fileList, setFileList] = useState([]);
  const [modelName, setModelName] = useState('');
  const [selectedType, setSelectedType] = useState('normal');

  // Placeholder for file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFileList(prev => [
      ...prev,
      ...files.map((file, idx) => ({ id: `${file.name}-${Date.now()}-${idx}`, name: file.name }))
    ]);
  };

  const handleRemoveFile = (id) => {
    setFileList(prev => prev.filter(file => file.id !== id));
  };

  const handleTypeSelection = (type) => {
    setSelectedType(type);
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({ fileList, name: modelName, type: selectedType });
    }
  };

  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', fontFamily: 'Roboto, Inter, Arial, sans-serif' } },
    // Upload Button Section
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', marginBottom: 2 } },
      React.createElement(
        'label',
        { style: buttonStyle },
        'Upload',
        React.createElement('input', { type: 'file', multiple: true, style: { display: 'none' }, onChange: handleFileUpload })
      )
    ),
    // File List Section
    React.createElement(
      'div',
      { style: { maxHeight: 100, border: '1px solid #e0e0e0', borderRadius: 4, background: 'white', padding: 4, overflowY: 'auto' } },
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
        fileList.map(file =>
          React.createElement(
            'div',
            { key: file.id, style: fileButtonStyle },
            React.createElement('span', { style: { flex: 1, marginRight: 8 } }, file.name),
            React.createElement('button', { style: removeButtonStyle, onClick: () => handleRemoveFile(file.id) }, '\u00D7')
          )
        )
      )
    ),
    // Model Name Section
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      React.createElement('label', { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Model Name'),
      React.createElement('input', {
        type: 'text',
        value: modelName,
        onChange: e => setModelName(e.target.value),
        style: { width: '100%', padding: '4px', borderRadius: 4, border: '1px solid #e0e0e0' }
      })
    ),
    // Model Type Buttons
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      React.createElement('label', { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Model Type'),
      React.createElement(
        'div',
        { style: { display: 'flex', gap: 8 } },
        React.createElement(
          'button',
          {
            style: Object.assign({}, modelTypeButtonBase, selectedType === 'lite' ? selectedModelTypeButton : {}),
            onClick: () => handleTypeSelection('lite')
          },
          'Lite'
        ),
        React.createElement(
          'button',
          {
            style: Object.assign({}, modelTypeButtonBase, selectedType === 'normal' ? selectedModelTypeButton : {}),
            onClick: () => handleTypeSelection('normal')
          },
          'Normal'
        ),
        React.createElement(
          'button',
          {
            style: Object.assign({}, modelTypeButtonBase, selectedType === 'advanced' ? selectedModelTypeButton : {}),
            onClick: () => handleTypeSelection('advanced')
          },
          'Advanced'
        )
      )
    ),
    // Submit Button Section
    React.createElement(
      'div',
      { style: { display: 'flex', justifyContent: 'center', marginTop: 16 } },
      React.createElement(
        'button',
        { style: Object.assign({ minWidth: 120 }, buttonStyle), onClick: handleSubmit },
        'Submit'
      )
    )
  );
}

export default ModelSelection;