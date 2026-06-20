import json

def extract_notebook(path):
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    
    with open('extracted.txt', 'w', encoding='utf-8') as out:
        for i, cell in enumerate(nb['cells']):
            out.write(f"--- Cell {i+1} ({cell['cell_type']}) ---\n")
            source = "".join(cell.get('source', []))
            out.write(source + "\n\n")

if __name__ == '__main__':
    extract_notebook('e:/flipkartevent/Flipkart_Grid7_Event_Congestion_Forecasting.ipynb')
