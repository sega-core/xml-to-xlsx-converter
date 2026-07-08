const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const xml2js = require('xml2js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xml') {
      cb(null, true);
    } else {
      cb(new Error('Только XML файлы разрешены'));
    }
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/convert', upload.single('xmlFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const filePath = req.file.path;
    const xmlData = fs.readFileSync(filePath, 'utf8');

    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });

    const result = await parser.parseStringPromise(xmlData);
    
    const excelData = extractHierarchicalData(result);

    const workbook = xlsx.utils.book_new();
    const worksheet = createSingleSheet(excelData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Отчет');

    // Настройка ширины колонок
    worksheet['!cols'] = [
      { wch: 20 },  // A
      { wch: 35 },  // B
      { wch: 20 },  // C
      { wch: 15 },  // D
      { wch: 20 },  // E
      { wch: 20 },  // F
      { wch: 20 },  // G
      { wch: 20 },  // H
      { wch: 15 }   // I
    ];

    const originalName = req.file.originalname || 'файл';
    const baseName = path.basename(originalName, '.xml');
    const outputFileName = `${baseName}-конвертировано.xlsx`;
    const outputPath = path.join(__dirname, 'uploads', outputFileName);

    xlsx.writeFile(workbook, outputPath);

    res.download(outputPath, outputFileName, (err) => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupErr) {
        console.error('Ошибка при удалении временных файлов:', cleanupErr);
      }
    });

  } catch (error) {
    console.error('Ошибка конвертации:', error);
    res.status(500).json({ error: 'Ошибка при конвертации XML в XLSX: ' + error.message });
  }
});

function extractHierarchicalData(xmlObj) {
  const result = {
    projectName: '',
    projectNumber: '',
    products: []
  };

  if (!xmlObj.Проект) {
    console.warn('Корневой элемент "Проект" не найден');
    return result;
  }

  const project = xmlObj.Проект;
  
  if (project.$) {
    result.projectName = project.$.Наименование || '';
    result.projectNumber = project.$.Номер || '';
  }

  if (!project.Изделие) {
    console.warn('Элемент "Изделие" не найден');
    return result;
  }

  let items = project.Изделие;
  if (!Array.isArray(items)) {
    items = [items];
  }

  items.forEach((item, index) => {
    const order = item.Заказ || '';
    
    const productData = {
      order: order,
      name: item.Наименование || '',
      quantity: item.Количество !== undefined ? parseFloat(item.Количество) : 0,
      details: []
    };

    if (item.СписокЭлементов) {
      let elements = item.СписокЭлементов;
      let detailItems = [];
      
      if (typeof elements === 'object') {
        Object.keys(elements).forEach(key => {
          if (key === 'Объект' || key === 'Блок' || key === 'Сборка' || 
              key === 'Панель' || key === 'Профиль' || key === 'Полуфабрикат') {
            let objs = elements[key];
            if (!Array.isArray(objs)) {
              objs = [objs];
            }
            objs.forEach(obj => {
              detailItems.push({
                type: key,
                data: obj
              });
            });
          }
        });
      }

      detailItems.forEach((detail, idx) => {
        const color = detail.data.ЦветМатериала || '';
        
        const detailData = {
          id: idx + 1,
          type: detail.type,
          name: detail.data.Наименование || '',
          quantity: detail.data.Количество !== undefined ? parseFloat(detail.data.Количество) : 0,
          color: color,
          operations: []
        };

        if (detail.data.СписокОпераций) {
          let operations = detail.data.СписокОпераций;
          let ops = [];
          
          if (typeof operations === 'object') {
            if (operations.СдельнаяОперация) {
              let opArray = operations.СдельнаяОперация;
              if (!Array.isArray(opArray)) {
                opArray = [opArray];
              }
              ops = opArray;
            } else if (Array.isArray(operations)) {
              ops = operations;
            } else if (typeof operations === 'object') {
              Object.keys(operations).forEach(key => {
                if (key.includes('Операция')) {
                  let opData = operations[key];
                  if (!Array.isArray(opData)) {
                    opData = [opData];
                  }
                  ops = ops.concat(opData);
                }
              });
            }
          }

          ops.forEach((op, opIdx) => {
            const laborTime = op.Трудоемкость !== undefined ? parseFloat(op.Трудоемкость) : 0;
            const price = op.Цена !== undefined ? parseFloat(op.Цена) : 0;
            const quantity = op.Количество !== undefined ? parseFloat(op.Количество) : 0;
            const cost = op.Стоимость !== undefined ? parseFloat(op.Стоимость) : 0;
            
            detailData.operations.push({
              id: opIdx + 1,
              name: op.Наименование || '',
              unit: op.ЕдИзм || '',
              laborTime: laborTime,                    // D - Норма времени (Трудоемкость)
              price: price,                            // E - Стоимость ед. времени (Цена)
              sumRubOp: laborTime * price,             // F - Сумма в руб на операцию (D * E)
              quantity: quantity,                      // G - Количество
              totalTime: quantity * laborTime,         // H - Суммарное время по операции (G * D)
              cost: cost                               // I - Стоимость
            });
          });
        }

        productData.details.push(detailData);
      });
    }

    result.products.push(productData);
  });

  return result;
}

function createSingleSheet(data) {
  const rows = [];
  
  // ===== СТРОКА 1: ИНФОРМАЦИЯ О ПРОЕКТЕ =====
  rows.push([
    data.projectName,           // A - Номер проекта
    data.projectName,           // B - Наименование проекта
    'Сумма в руб на заказ'      // C - Константа
  ]);
  
  // ===== ИЗДЕЛИЯ =====
  data.products.forEach((product) => {
    // Строка изделия
    rows.push([
      product.order,                                  // A - Заказ
      product.name,                                   // B - Наименование
      product.quantity,                               // C - Количество
      0,                                              // D - Сумма всех времён на изделие (пока 0)
      0,                                              // E - Сумма в руб. на изделие (пока 0)
      0,                                              // F - Сумма времени на все изделия (пока 0)
      0                                               // G - Сумма в руб на все изделия (пока 0)
    ]);
    
    // ===== ДЕТАЛИ =====
    product.details.forEach((detail) => {
      // Строка детали
      rows.push([
        'дет. №' + detail.id,                         // A - порядковый номер + "деталь"
        detail.name,                                   // B - Наименование
        detail.color,                                  // C - ЦветМатериала
        detail.quantity,                               // D - Количество
        0,                                             // E - Сумма времени по всем операциям на деталь (пока 0)
        0,                                             // F - Сумма в руб на одну деталь (пока 0)
        0,                                             // G - Сумма времени на все детали на изделие (пока 0)
        0                                              // H - Сумма в руб на все детали в изделии (пока 0)
      ]);
      
      // ===== ОПЕРАЦИИ =====
      detail.operations.forEach((op) => {
        rows.push([
          'оп. №' + op.id,                             // A - порядковый номер + "операция"
          op.name,                                     // B - Наименование
          op.unit || '',                               // C - Ед.изм.
          op.laborTime || 0,                           // D - Норма времени (Трудоемкость)
          op.price || 0,                               // E - Стоимость ед. времени (Цена)
          op.sumRubOp || 0,                            // F - Сумма в руб на операцию (D * E)
          op.quantity || 0,                            // G - Количество
          op.totalTime || 0,                           // H - Суммарное время по операции (G * D)
          op.cost || 0                                 // I - Стоимость
        ]);
      });
    });
    
    // Пустая строка после изделия
    rows.push([]);
  });
  
  return xlsx.utils.aoa_to_sheet(rows);
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log('Ожидание загрузки XML файла...');
});